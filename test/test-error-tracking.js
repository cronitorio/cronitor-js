const chai = require('chai');
const nock = require('nock');
const zlib = require('zlib');
const Cronitor = require('../lib/cronitor');
const Monitor = require('../lib/monitor');
const Event = require('../lib/event');
const ingest = require('../lib/ingest');

const { expect } = chai;

function decodeGzippedEnvelope(rawBody) {
    const buf = Buffer.isBuffer(rawBody)
        ? rawBody
        : Buffer.from(rawBody, 'hex');
    const text = zlib.gunzipSync(buf).toString('utf8');
    const lines = text.trim().split('\n');
    return {
        envelopeHeader: JSON.parse(lines[0]),
        itemHeader: JSON.parse(lines[1]),
        event: JSON.parse(lines[2]),
    };
}

describe('Error Tracking', () => {
    let previousMonitorApi;
    let previousEventApi;

    beforeEach(() => {
        previousMonitorApi = Monitor._api;
        previousEventApi = Event._api;
        nock.disableNetConnect();
    });

    afterEach(() => {
        nock.cleanAll();
        nock.enableNetConnect();
        Monitor._api = previousMonitorApi;
        Event._api = previousEventApi;
    });

    describe('DSN parsing', () => {
        it('parses a standard DSN', () => {
            const parsed = ingest.parseDsn('https://ing_abc123@cronitor.link/1');
            expect(parsed).to.deep.equal({
                ingestKey: 'ing_abc123',
                url: 'https://cronitor.link/api/1/envelope/',
                publicDsn: 'https://ing_abc123@cronitor.link/1',
            });
        });

        it('ignores trailing slashes', () => {
            const parsed = ingest.parseDsn('https://ing_abc123@cronitor.link/42/');
            expect(parsed).to.deep.equal({
                ingestKey: 'ing_abc123',
                url: 'https://cronitor.link/api/42/envelope/',
                publicDsn: 'https://ing_abc123@cronitor.link/42',
            });
        });

        it('supports custom host and port', () => {
            const parsed = ingest.parseDsn('http://dev_key@localhost:9100/1');
            expect(parsed).to.deep.equal({
                ingestKey: 'dev_key',
                url: 'http://localhost:9100/api/1/envelope/',
                publicDsn: 'http://dev_key@localhost:9100/1',
            });
        });

        it('ignores optional secret in DSN', () => {
            const parsed = ingest.parseDsn('https://pub_key:secret@cronitor.link/42');
            expect(parsed).to.deep.equal({
                ingestKey: 'pub_key',
                url: 'https://cronitor.link/api/42/envelope/',
                publicDsn: 'https://pub_key@cronitor.link/42',
            });
        });

        it('defaults missing project path to 1', () => {
            const parsed = ingest.parseDsn('https://ing_abc123@cronitor.link');
            expect(parsed).to.deep.equal({
                ingestKey: 'ing_abc123',
                url: 'https://cronitor.link/api/1/envelope/',
                publicDsn: 'https://ing_abc123@cronitor.link/1',
            });
        });

        it('returns null for empty or invalid DSNs', () => {
            expect(ingest.parseDsn(null)).to.be.null;
            expect(ingest.parseDsn('')).to.be.null;
            expect(ingest.parseDsn('   ')).to.be.null;
            expect(ingest.parseDsn('not-a-url')).to.be.null;
            expect(ingest.parseDsn('ftp://key@cronitor.link/1')).to.be.null;
            expect(ingest.parseDsn('https://cronitor.link/1')).to.be.null;
        });
    });

    describe('Envelope transport', () => {
        it('sends gzipped Sentry envelope with expected headers and no Authorization header', async () => {
            let capturedHeaders = null;
            let capturedBody = null;

            const scope = nock('https://cronitor.link')
                .post('/api/1/envelope/')
                .reply(function (uri, requestBody) {
                    capturedHeaders = this.req.headers;
                    capturedBody = requestBody;
                    return [200, {}];
                });

            const client = Cronitor('secret_api_key', {
                dsn: 'https://ing_abc123@cronitor.link/1',
                release: '2.7.0',
                environment: 'production',
            });

            const eventId = client.captureMessage('service booted', { level: 'info' });
            expect(eventId).to.be.a('string').with.lengthOf(32);

            const drained = await client.flush(2000);
            expect(drained).to.be.true;
            expect(scope.isDone()).to.be.true;

            expect(capturedHeaders['content-type']).to.eq('application/x-sentry-envelope');
            expect(capturedHeaders['content-encoding']).to.eq('gzip');
            expect(capturedHeaders['user-agent']).to.eq('cronitor-js');
            expect(capturedHeaders['x-sentry-auth']).to.eq(
                'Sentry sentry_key=ing_abc123, sentry_version=7, sentry_client=cronitor-js/2.7.0'
            );
            expect(capturedHeaders).to.not.have.property('authorization');

            const { envelopeHeader, itemHeader, event } = decodeGzippedEnvelope(capturedBody);
            expect(envelopeHeader.event_id).to.eq(eventId);
            expect(envelopeHeader.dsn).to.eq('https://ing_abc123@cronitor.link/1');
            expect(envelopeHeader.sdk).to.deep.equal({ name: 'cronitor-js', version: '2.7.0' });
            expect(envelopeHeader.sent_at).to.match(/^\d{4}-\d{2}-\d{2}T.*Z$/);

            expect(itemHeader.type).to.eq('event');
            expect(itemHeader.content_type).to.eq('application/json');
            expect(itemHeader.length).to.be.a('number').above(0);

            expect(event.platform).to.eq('node');
            expect(event.release).to.eq('2.7.0');
            expect(event.environment).to.eq('production');
            expect(event.server_name).to.be.a('string');
        });

        it('never falls back to apiKey when DSN is missing or invalid', async () => {
            const clientNoDsn = Cronitor('api_key_only', { dsn: null });
            const clientBadDsn = Cronitor('api_key_only', { dsn: 'invalid-dsn' });

            expect(clientNoDsn.captureMessage('hello')).to.be.null;
            expect(clientBadDsn.captureException(new Error('boom'))).to.be.null;
            expect(await clientNoDsn.flush()).to.be.true;
            expect(await clientBadDsn.flush()).to.be.true;
        });

        it('swallows HTTP errors and 429 rate limits without throwing', async () => {
            const scope = nock('https://cronitor.link')
                .post('/api/1/envelope/')
                .reply(429, {}, { 'Retry-After': '30' });

            const client = Cronitor('api_key', { dsn: 'https://ing_key@cronitor.link/1' });
            const firstId = client.captureMessage('first');
            expect(firstId).to.be.a('string');
            expect(await client.flush()).to.be.true;
            expect(scope.isDone()).to.be.true;

            const droppedId = client.captureMessage('second while rate limited');
            expect(droppedId).to.be.null;
        });
    });

    describe('captureException & stack parsing', () => {
        it('captures error with stack frames, source context, and cause chain oldest-first', async () => {
            let capturedBody = null;
            const scope = nock('https://cronitor.link')
                .post('/api/1/envelope/')
                .reply(200, function (uri, requestBody) {
                    capturedBody = requestBody;
                    return {};
                });

            const client = Cronitor('api_key', {
                dsn: 'https://ing_key@cronitor.link/1',
                environment: 'staging',
            });

            const rootCause = new TypeError('connection reset');
            const outer = new Error('order import failed');
            outer.cause = rootCause;

            const eventId = client.captureException(outer, {
                monitor: 'import-orders',
                series: 'run-42',
                level: 'critical',
                tags: { region: 'us-east-1' },
                extra: { batch: 7, badNum: NaN },
                fingerprint: ['import-orders', 'timeout'],
            });

            expect(eventId).to.be.a('string');
            await client.flush();
            expect(scope.isDone()).to.be.true;

            const { event } = decodeGzippedEnvelope(capturedBody);
            expect(event.level).to.eq('fatal');
            expect(event.tags['cronitor.monitor']).to.eq('import-orders');
            expect(event.tags['cronitor.series']).to.eq('run-42');
            expect(event.tags.region).to.eq('us-east-1');
            expect(event.extra).to.deep.equal({ batch: 7, badNum: 'NaN' });
            expect(event.fingerprint).to.deep.equal(['import-orders', 'timeout']);

            expect(event.exception.values).to.have.lengthOf(2);
            expect(event.exception.values[0].type).to.eq('TypeError');
            expect(event.exception.values[0].value).to.eq('connection reset');
            expect(event.exception.values[1].type).to.eq('Error');
            expect(event.exception.values[1].value).to.eq('order import failed');
            expect(event.exception.values[1].mechanism).to.deep.equal({ type: 'generic', handled: true });

            const frames = event.exception.values[1].stacktrace.frames;
            expect(frames.length).to.be.above(0);
            const lastFrame = frames[frames.length - 1];
            expect(lastFrame.filename).to.include('test-error-tracking.js');
            expect(lastFrame.lineno).to.be.a('number');
            expect(lastFrame.colno).to.be.a('number');
            expect(lastFrame.in_app).to.be.true;
            expect(lastFrame.context_line).to.include("new Error('order import failed')");
            expect(lastFrame.pre_context).to.be.an('array').with.length.at.most(5);
            expect(lastFrame.post_context).to.be.an('array').with.length.at.most(5);
        });

        it('returns null without throwing when error is missing or not capturable', () => {
            const client = Cronitor('api_key', { dsn: 'https://ing_key@cronitor.link/1' });
            expect(client.captureException()).to.be.null;
            expect(client.captureException(null)).to.be.null;
            expect(client.captureException('plain string')).to.be.null;
            expect(client.captureException({ message: 'no stack' })).to.be.null;
        });

        it('trims oversized events without mutating the caller object', () => {
            const callerExtra = { huge: 'x'.repeat(1000 * 1024) };
            const event = {
                event_id: 'a'.repeat(32),
                extra: callerExtra,
                exception: {
                    values: [{
                        type: 'Error',
                        value: 'big',
                        stacktrace: {
                            frames: Array.from({ length: 30 }, (_, i) => ({
                                filename: 'app.js',
                                lineno: i + 1,
                                pre_context: ['a', 'b'],
                                post_context: ['c', 'd'],
                            })),
                        },
                    }],
                },
            };

            const bytes = ingest.eventBytes(event);
            expect(bytes.length).to.be.at.most(ingest.MAX_EVENT_BYTES);
            const decoded = JSON.parse(bytes.toString('utf8'));
            expect(decoded.extra._trimmed).to.include('extra dropped');
            expect(callerExtra.huge.length).to.eq(1000 * 1024);
        });
    });

    describe('captureMessage & Monitor bindings', () => {
        it('sends message event with fingerprint string coerced to array and no exception field', async () => {
            let capturedBody = null;
            const scope = nock('https://cronitor.link')
                .post('/api/1/envelope/')
                .reply(200, function (uri, requestBody) {
                    capturedBody = requestBody;
                    return {};
                });

            const client = Cronitor('api_key', {
                dsn: 'https://ing_key@cronitor.link/1',
                environment: 'production',
            });
            const monitor = new client.Monitor('nightly-job');

            const eventId = monitor.captureMessage('Disk 90% full', {
                level: 'warn',
                extra: { mount: '/var' },
                fingerprint: 'disk-space-warning',
            });

            expect(eventId).to.be.a('string');
            await client.flush();
            expect(scope.isDone()).to.be.true;

            const { event } = decodeGzippedEnvelope(capturedBody);
            expect(event.level).to.eq('warning');
            expect(event.message).to.deep.equal({ formatted: 'Disk 90% full' });
            expect(event).to.not.have.property('exception');
            expect(event.tags['cronitor.monitor']).to.eq('nightly-job');
            expect(event.environment).to.eq('production');
            expect(event.extra).to.deep.equal({ mount: '/var' });
            expect(event.fingerprint).to.deep.equal(['disk-space-warning']);
        });
    });

    describe('wrap() auto-capture and rethrow', () => {
        it('pings fail, captures unhandled exception, and rethrows on sync throw', async () => {
            let envelopeBody = null;
            const pingStates = [];

            const pingScope = nock('https://cronitor.link')
                .get('/ping/api_key/sync-job')
                .query(true)
                .times(2)
                .reply(function (uri) {
                    const m = /[?&]state=([^&]+)/.exec(uri);
                    if (m) pingStates.push(m[1]);
                    return [200, 'ok'];
                });

            const envelopeScope = nock('https://cronitor.link')
                .post('/api/1/envelope/')
                .reply(200, function (uri, requestBody) {
                    envelopeBody = requestBody;
                    return {};
                });

            const client = Cronitor('api_key', { dsn: 'https://ing_key@cronitor.link/1' });
            const boom = new Error('sync failure');
            const wrapped = client.wrap('sync-job', () => {
                throw boom;
            });

            let caught = null;
            try {
                await wrapped();
            } catch (err) {
                caught = err;
            }

            expect(caught).to.equal(boom);
            await client.flush();
            expect(pingScope.isDone()).to.be.true;
            expect(envelopeScope.isDone()).to.be.true;
            expect(pingStates).to.deep.equal(['run', 'fail']);

            const { event } = decodeGzippedEnvelope(envelopeBody);
            expect(event.tags['cronitor.monitor']).to.eq('sync-job');
            expect(event.tags['cronitor.series']).to.be.a('string').with.lengthOf(8);
            expect(event.exception.values[0].mechanism).to.deep.equal({
                type: 'cronitor.wrap',
                handled: false,
            });
        });

        it('pings fail, captures unhandled exception, and rejects on async rejection', async () => {
            let envelopeBody = null;
            nock('https://cronitor.link')
                .get('/ping/api_key/async-job')
                .query(true)
                .times(2)
                .reply(200, 'ok');

            const envelopeScope = nock('https://cronitor.link')
                .post('/api/1/envelope/')
                .reply(200, function (uri, requestBody) {
                    envelopeBody = requestBody;
                    return {};
                });

            const client = Cronitor('api_key', { dsn: 'https://ing_key@cronitor.link/1' });
            const boom = new Error('async failure');
            const wrapped = client.wrap('async-job', async () => {
                throw boom;
            });

            let caught = null;
            try {
                await wrapped();
            } catch (err) {
                caught = err;
            }

            expect(caught).to.equal(boom);
            await client.flush();
            expect(envelopeScope.isDone()).to.be.true;
            const { event } = decodeGzippedEnvelope(envelopeBody);
            expect(event.exception.values[0].value).to.eq('async failure');
        });

        it('respects per-call captureExceptions: false while still rethrowing', async () => {
            nock('https://cronitor.link')
                .get('/ping/api_key/opt-out-job')
                .query(true)
                .times(2)
                .reply(200, 'ok');

            const client = Cronitor('api_key', { dsn: 'https://ing_key@cronitor.link/1' });
            const boom = new Error('no capture');
            const wrapped = client.wrap('opt-out-job', () => {
                throw boom;
            }, { captureExceptions: false });

            let caught = null;
            try {
                await wrapped();
            } catch (err) {
                caught = err;
            }

            expect(caught).to.equal(boom);
            expect(await client.flush()).to.be.true;
        });

        it('respects client-level captureExceptions: false', async () => {
            nock('https://cronitor.link')
                .get('/ping/api_key/global-opt-out')
                .query(true)
                .times(2)
                .reply(200, 'ok');

            const client = Cronitor('api_key', {
                dsn: 'https://ing_key@cronitor.link/1',
                captureExceptions: false,
            });
            const boom = new Error('global opt out');
            const wrapped = client.wrap('global-opt-out', () => {
                throw boom;
            });

            let caught = null;
            try {
                await wrapped();
            } catch (err) {
                caught = err;
            }

            expect(caught).to.equal(boom);
            expect(await client.flush()).to.be.true;
        });
    });

    describe('flush()', () => {
        it('returns false when in-flight request exceeds timeout', async () => {
            nock('https://cronitor.link')
                .post('/api/1/envelope/')
                .delay(250)
                .reply(200, {});

            const client = Cronitor('api_key', { dsn: 'https://ing_key@cronitor.link/1' });
            client.captureMessage('slow envelope');

            const drained = await client.flush(30);
            expect(drained).to.be.false;

            const drainedLater = await client.flush(1000);
            expect(drainedLater).to.be.true;
        });
    });

    describe('ErrorApp & ErrorGroup REST API', () => {
        it('supports ErrorApp CRUD and rotateKey', async () => {
            const client = Cronitor('api_key_rest');

            const createScope = nock('https://cronitor.io')
                .post('/api/error-apps', { name: 'Billing API' })
                .reply(200, {
                    key: 'app_123',
                    name: 'Billing API',
                    dsn: 'https://ing_1@cronitor.link/1',
                });

            const app = await client.ErrorApp.create({ name: 'Billing API' });
            expect(createScope.isDone()).to.be.true;
            expect(app.key).to.eq('app_123');
            expect(app.dsn).to.eq('https://ing_1@cronitor.link/1');

            const listScope = nock('https://cronitor.io')
                .get('/api/error-apps')
                .query({ page: '1', pageSize: '50' })
                .reply(200, { error_apps: [{ key: 'app_123', name: 'Billing API' }] });

            const apps = await client.ErrorApp.list();
            expect(listScope.isDone()).to.be.true;
            expect(apps).to.have.lengthOf(1);
            expect(apps[0].key).to.eq('app_123');

            const updateScope = nock('https://cronitor.io')
                .patch('/api/error-apps/app_123', { name: 'Payments API' })
                .reply(200, { key: 'app_123', name: 'Payments API', dsn: 'https://ing_1@cronitor.link/1' });

            await app.update({ name: 'Payments API' });
            expect(updateScope.isDone()).to.be.true;
            expect(app.data.name).to.eq('Payments API');

            const rotateScope = nock('https://cronitor.io')
                .post('/api/error-apps/app_123/rotate-key')
                .reply(200, { key: 'app_123', name: 'Payments API', dsn: 'https://ing_2@cronitor.link/1' });

            const rotated = await app.rotateKey();
            expect(rotateScope.isDone()).to.be.true;
            expect(rotated).to.equal(app);
            expect(app.dsn).to.eq('https://ing_2@cronitor.link/1');

            const deleteScope = nock('https://cronitor.io')
                .delete('/api/error-apps/app_123')
                .reply(204);

            expect(await app.delete()).to.be.true;
            expect(deleteScope.isDone()).to.be.true;
        });

        it('throws ErrorAppNotFound on 404', async () => {
            nock('https://cronitor.io')
                .get('/api/error-apps/missing')
                .reply(404, { detail: 'Not found' });

            const client = Cronitor('api_key_rest');
            const app = new client.ErrorApp('missing');
            let caught = null;
            try {
                await app.loadData();
            } catch (err) {
                caught = err;
            }
            expect(caught).to.be.instanceOf(Cronitor.ErrorAppNotFound);
        });

        it('supports ErrorGroup list, loadData, update, events, event, and 404 handling', async () => {
            const client = Cronitor('api_key_rest');

            const listScope = nock('https://cronitor.io')
                .get('/api/errors')
                .query({ app: 'app_123', status: 'open', env: 'production', page: '1', pageSize: '50' })
                .reply(200, { errors: [{ key: 'err_1', title: 'TypeError: boom', status: 'open' }] });

            const groups = await client.ErrorGroup.list({ app: 'app_123', status: 'open', env: 'production' });
            expect(listScope.isDone()).to.be.true;
            expect(groups).to.have.lengthOf(1);
            expect(groups[0].key).to.eq('err_1');

            const group = new client.ErrorGroup('err_1');
            const getScope = nock('https://cronitor.io')
                .get('/api/errors/err_1')
                .reply(200, { key: 'err_1', title: 'TypeError: boom', status: 'open' });
            const data = await group.loadData();
            expect(getScope.isDone()).to.be.true;
            expect(data.title).to.eq('TypeError: boom');

            const patchScope = nock('https://cronitor.io')
                .patch('/api/errors/err_1', { status: 'resolved', env: 'production' })
                .reply(200, { key: 'err_1', status: 'resolved' });
            await group.update({ status: 'resolved', env: 'production' });
            expect(patchScope.isDone()).to.be.true;
            expect(group.data.status).to.eq('resolved');

            const eventsScope = nock('https://cronitor.io')
                .get('/api/errors/err_1/events')
                .query({ env: 'production', limit: '25' })
                .reply(200, { data: [{ event_id: 'evt_1' }] });
            const events = await group.events({ env: 'production', limit: 25 });
            expect(eventsScope.isDone()).to.be.true;
            expect(events.data[0].event_id).to.eq('evt_1');

            const eventScope = nock('https://cronitor.io')
                .get('/api/errors/err_1/events/evt_1')
                .reply(200, { event_id: 'evt_1', level: 'error' });
            const single = await group.event('evt_1');
            expect(eventScope.isDone()).to.be.true;
            expect(single.level).to.eq('error');

            nock('https://cronitor.io')
                .get('/api/errors/missing')
                .reply(404, { detail: 'Not found' });
            let caught = null;
            try {
                await new client.ErrorGroup('missing').loadData();
            } catch (err) {
                caught = err;
            }
            expect(caught).to.be.instanceOf(Cronitor.ErrorGroupNotFound);
        });
    });

    describe('Error monitors YAML', () => {
        it('reads the errors section from cronitor.yaml', async () => {
            const client = Cronitor('api_key_yaml');
            const parsed = await client.readConfig({ path: './test/cronitor.yaml', output: true });
            expect(parsed).to.have.property('errors');
            expect(parsed.errors['billing-error-spikes']).to.deep.include({
                trigger: 'spike',
                threshold: 25,
                window: '5m',
                per: 'fingerprint',
            });
        });
    });
});
