const Monitor = require('../lib/monitor'),
    chai = require('chai'),
    sinon = require('sinon'),
    sinonChai = require('sinon-chai'),
    sinonStubPromise = require('sinon-stub-promise'),
    fs = require('fs').promises,
    yaml = require('js-yaml'),
    expect = chai.expect;


sinonStubPromise(sinon);
chai.use(sinonChai);

const cronitor = require('../lib/cronitor')('apiKey123');

describe('Config Parser', () => {
    context('readConfig', () => {

        it('should raise an error when no path to config is set', async () => {
            try {
                await cronitor.readConfig()
                expect.fail('Should have raised an error');
            } catch (err) {
                expect(err.message).to.eq('Must include a path to config file e.g. cronitor.readConfig({path: \'./cronitor.yaml\'})');
            }
        });

        it('should read a config file into memory', async () => {
            expect(cronitor.config).to.be.undefined;
            await cronitor.readConfig({path: './test/cronitor.yaml'});
            expect(cronitor.config).to.not.be.undefined;
        });

    });

    context('validateConfig', () => {
        afterEach(() => {
            sinon.restore();
            cronitor.path = null;
        });
        it('should call Monitor.put with a YAML payload and rollback: true', async () => {
            const stub = sinon.stub(cronitor.Monitor, 'put');
            await cronitor.validateConfig({path: './test/cronitor.yaml'});
            expect(stub).to.be.calledWith(sinon.match.object, { rollback: true, format: Monitor.requestType.YAML});
        });

        it('should raise an exception if no path is provided', async () => {
            try {
                await cronitor.validateConfig();
                expect.fail('Should have raised an error');
            } catch (err) {
                expect(err.message).to.eq('Must include a path to config file e.g. cronitor.applyConfig({path: \'./cronitor.yaml\'})');
            }
        })
    });

    context('applyConfig', () => {
        afterEach(async () => {
            sinon.restore();
            cronitor.path = null;
        });

        it('should call Monitor.put with array of monitors and rollback: false', async () => {
            const stub = sinon.stub(cronitor.Monitor, 'put');
            await cronitor.applyConfig({path: './test/cronitor.yaml'});
            expect(stub).to.be.calledWith(sinon.match.object, { rollback: false, format: Monitor.requestType.YAML});
        });

        it('should raise an exception if no path is provided', async () => {
            try {
                await cronitor.validateConfig();
                expect.fail('Should have raised an error');
            } catch (err) {
                expect(err.message).to.eq('Must include a path to config file e.g. cronitor.applyConfig({path: \'./cronitor.yaml\'})');
            }
        })
    });


    context('generateConfig', () => {
        afterEach(async () => {
            sinon.restore();
            await fs.unlink('./cronitor-test.yaml');
        });

        it('should write a YAML file to the location specified', async () => {
            const stub = sinon.stub(cronitor._api.axios, 'get');
            const dummyData = await fs.readFile('./test/cronitor.yaml', 'utf8');
            stub.resolves({data: dummyData})
            const resp = await cronitor.generateConfig({path: './cronitor-test.yaml'});

            expect(stub).to.be.called;
            expect(resp).to.be.true;

            // read the config file and check that it is valid YAML
            try {
                const data = await fs.readFile('./cronitor-test.yaml', 'utf8');
                const config = yaml.load(data);
                expect(Object.keys(config)).to.include('jobs');
                expect(Object.keys(config)).to.include('checks');
                expect(Object.keys(config)).to.include('heartbeats');
            } catch (err) {
                console.error('Failed to read the file:', err);
            }
        });

        it('should allow a group to be specified', async () => {
            const stub = sinon.stub(cronitor._api.axios, 'get');
            const dummyData = await fs.readFile('./test/cronitor.yaml', 'utf8');
            stub.resolves({data: dummyData})
            const resp = await cronitor.generateConfig({path: './cronitor-test.yaml', group: 'test-group'});

            expect(stub).to.be.calledWith('https://cronitor.io/api/monitors.yaml?group=test-group');
            expect(resp).to.be.true;
        });
    });
});

describe('Telemetry API', () => {
    const monitor = new cronitor.Monitor('monitor-key');
    const validParams = {
        message: 'hello there',
        metrics: {
            count: 1,
            error_count: 1,
            duration: 100,
        },
        env: 'production',
        host: '10-0-0-223',
        series: 'world',
    };


    Object.values(cronitor.Monitor.State).forEach((state) => {
        context(`Ping ${state.toUpperCase()}`, () => {

            afterEach(() => {
                sinon.restore();
            });

            it(`calls ${state} correctly`, function(done) {
                const pingStub = sinon.stub(cronitor._api.axios, 'get');
                monitor.ping({ state });
                expect(pingStub).to.be.called;
                done();
            });

            it(`calls ${state} correctly with all params`, function(done) {
                const pingStub = sinon.stub(cronitor._api.axios, 'get');
                monitor.ping({ state, ...validParams });

                const params = Object.assign({}, { state, ...validParams });

                expect(pingStub).to.be.calledWith(
                    monitor._api.pingUrl(monitor.key),
                    { params, paramsSerializer: sinon.match.any });
                done();
            });
        });
    });
});

describe('Monitor', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('should raise an exception when no key is provided', () => {
        expect(() => { new cronitor.Monitor(); }).to.throw();
    });

    it('should pause', function(done) {
        const monitor = new cronitor.Monitor('a-key');
        const stub = sinon.stub(monitor._api.axios, 'get');
        monitor.pause(1000);
        expect(stub).to.be.calledWith(`${monitor._api.monitorUrl(monitor.key)}/pause/1000`);
        done();
    });

    it('should unpause', function(done) {
        const monitor = new cronitor.Monitor('a-key');
        const stub = sinon.stub(monitor._api.axios, 'get');
        monitor.unpause();
        expect(stub).to.be.calledWith(`${monitor._api.monitorUrl(monitor.key)}/pause/0`);
        done();
    });

    it('should reset to ok', function(done) {
        const monitor = new cronitor.Monitor('a-key');
        const stub = sinon.stub(monitor._api.axios, 'get');
        monitor.ok();
        expect(stub).to.be.calledWith(`${monitor._api.pingUrl(monitor.key)}`);
        done();
    });

    it('should use eu subdomain when region is set to eu', function(done) {
        const euCronitor = require('../lib/cronitor')('apiKey123', { region: 'eu' });
        const monitor = new euCronitor.Monitor('a-key');
        const stub = sinon.stub(monitor._api.axios, 'get');
        monitor.ok();
        expect(stub).to.be.calledWith('https://eu.cronitor.link/ping/apiKey123/a-key');
        done();
    });

    it('should load monitor data', async function() {
        const monitor = new cronitor.Monitor('a-key');
        const mockResponse = { data: { name: 'Test Monitor', type: 'job' } };
        const stub = sinon.stub(monitor._api.axios, 'get').resolves(mockResponse);
        
        const result = await monitor.loadData();
        
        expect(stub).to.be.calledWith(monitor._api.monitorUrl(monitor.key));
        expect(result).to.deep.equal(mockResponse.data);
        expect(monitor.data).to.deep.equal(mockResponse.data);
    });

    it('should return error response when loadData fails', async function() {
        const monitor = new cronitor.Monitor('a-key');
        const errorResponse = { status: 404, data: { error: 'Not Found' } };
        const stub = sinon.stub(monitor._api.axios, 'get')
            .rejects({ response: errorResponse });
        
        const result = await monitor.loadData();
        
        expect(stub).to.be.calledWith(monitor._api.monitorUrl(monitor.key));
        expect(result).to.deep.equal(errorResponse);
        expect(monitor.data).to.be.null;
    });
});

describe('Event', () => {
    let clock, event;

    beforeEach(() => {
        clock = sinon.useFakeTimers();
        event = new cronitor.Event('monitor-key');
    });

    afterEach(() => {
        clock.restore();
    });

    context('constructor', () => {
        it('should set initial values', () => {
            expect(event._state.count).to.eq(0);
            expect(event.monitor).to.be.instanceOf(Monitor);
            expect(event.intervalSeconds).to.eq(60);
            expect(event.intervalId).to.exist;
        });


        it('should set intervalSeconds to provided value', () => {
            event = new cronitor.Event('monitor-key', { intervalSeconds: 30 });
            expect(event.intervalSeconds).to.eq(30);
        });

        context('when no key is provided', () => {
            it('should raise an exception if a key is not provided', () => {
                const fnc = () => { new cronitor.Event(); };
                expect(fnc).to.throw('You must initialize Event with a key.');
            });
        });
    });

    context('tick', () => {
        it('should increase the called count', () => {
            expect(event._state.count).to.eq(0);
            event.tick();
            expect(event._state.count).to.eq(1);
            event.tick();
            expect(event._state.count).to.eq(2);
            event.tick(0);
            expect(event._state.count).to.eq(2);
            event.tick(5);
            expect(event._state.count).to.eq(7);
        });
    });

    context('stop', () => {
        it('should clear the intervalId', () => {
            event.stop();
            expect(event.intervalId).to.not.exist;
        });

        context('when there are unsynced calls', () => {
            it('should call _flush', () => {
                const spy = sinon.spy(event, '_flush');
                event.tick();
                event.stop();
                expect(spy.calledOnce).to.be.true;
            });
        });
    });

    context('fail', () => {
        afterEach(() => {
            sinon.restore();
        });
        it('should stop then ping fail', () => {
            const stop = sinon.spy(event, 'stop');
            const ping = sinon.stub(event.monitor, 'ping');
            event.fail();
            expect(stop).to.be.calledOnce;
            expect(ping).to.be.calledTwice;
        });
    });

    context('_flush', () => {
        afterEach(() => {
            sinon.restore();
        });

        it('should ping tick with number of calls since last tick', () => {
            const ping = sinon.stub(event.monitor, 'ping');
            event.tick();
            event._flush();
            expect(ping).to.have.been.calledWith({ metrics: { count: 1, duration: event.intervalSeconds, error_count: 0 } });
        });

        it('should ping tick with number of errors reported', () => {
            const ping = sinon.stub(event.monitor, 'ping');
            event.error();
            event._flush();
            expect(ping).to.have.been.calledWith({ metrics: { count: 0, duration: event.intervalSeconds, error_count: 1 } });
        });

        it('should reset the count and errorCount', () => {
            const stub = sinon.stub(event.monitor, 'ping');
            event.tick();
            expect(event._state.count).to.eq(1);
            event.error();
            expect(event._state.errorCount).to.eq(1);
            event._flush();
            expect(event._state.count).to.eq(0);
            expect(event._state.errorCount).to.eq(0);
        });
    });
});

describe.skip('test wrap cron', () => {
    it('should load the node-cron library and define the wrapper function', () => {
        cronitor.wraps(require('node-cron'));

        cronitor.schedule('everyMinuteJob', '* * * * *', () => {
            console.log('running node-cron every min');
        });

    });

    it('should load the NodeCron library and define the wrapper function', () => {
        cronitor.wraps(require('cron'));

        cronitor.schedule('everyMinuteJob', '* * * * *', () => {
            console.log('running cron every min');
            return 'i ran for 10 seconds';
        });

    });
});

describe.skip('functional test YAML API', () => {
    const cronitor = require('../lib/cronitor')('ADD_YOUR_API_KEY')

    it('should read a config file and validate it', async () => {
        const validated = await cronitor.validateConfig({path: './test/cronitor.yaml'});
        expect(validated).to.be.true;
    });

    it('should read a config file and apply it', async () => {
        const applied = await cronitor.applyConfig({path: './test/cronitor.yaml'});
        expect(applied).to.be.true;

        // clean up if this runs against prod
        const config = await cronitor.readConfig({path: './test/cronitor.yaml', output: true});
        keys = Object.keys(config).map((k) => Object.keys(config[k])).flat();
        keys.map(async (k) => {
            const monitor = new cronitor.Monitor(k);
            await monitor.delete()
        });
    });

    it('should create a monitor from an object', async () => {
        const monitor = await Monitor.put({
            key: 'test-monitor',
            name: 'Test Monitor',
            type: 'job',
        })
        expect(monitor).to.be.instanceOf(Monitor);
        await monitor.delete();
    });

    it('should create monitors from a list', async () => {
        const monitors = await Monitor.put([{
            key: 'test-monitor',
            name: 'Test Monitor',
            type: 'job',
        },{
            key: 'test-monitor-1',
            name: 'Test Monitor1',
            type: 'job',
        }])
        expect(monitors).to.be.instanceOf(Array);
        expect(monitors.length).to.eq(2);
        monitors.forEach(async (m) => await m.delete());
    });
})