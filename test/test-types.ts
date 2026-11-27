// TypeScript verification test file
// This file tests that the type definitions work correctly
// Run: npm run typecheck

import Cronitor from '../index';
import cronitorCjs = require('../index');

// Test: Initialize Cronitor (both ESM default import and CJS import=)
const cronitor = Cronitor('api_key_123');
const cronitorWithConfig = cronitorCjs('api_key_123', {
    apiVersion: '2020-10-01',
    environment: 'staging',
    timeout: 5000,
    region: 'eu',
    dsn: 'https://ing_abc123@cronitor.link/1',
    release: '2.7.0',
    captureExceptions: true,
});

// Test: Monitor creation
const monitor = new cronitor.Monitor('test-monitor');

// Test: Ping with various params
monitor.ping();
monitor.ping('string message');
monitor.ping({
    state: 'run',
    message: 'test',
    metrics: {
        duration: 100,
        count: 50,
        error_count: 2
    },
    series: 'abc123',
    host: 'server-1',
    env: 'production'
});

// Test: Monitor State enum
monitor.ping({ state: cronitor.Monitor.State.RUN });
monitor.ping({ state: cronitor.Monitor.State.COMPLETE });
monitor.ping({ state: cronitor.Monitor.State.FAIL });
monitor.ping({ state: cronitor.Monitor.State.OK });

// Test: Monitor methods
(async () => {
    await monitor.pause(24);
    await monitor.unpause();
    await monitor.ok();
    await monitor.ok({ message: 'all good' });
    await monitor.delete();
    await monitor.loadData();
})();

// Test: Monitor.put including type: 'errors'
(async () => {
    const singleMonitor = await cronitor.Monitor.put({
        type: 'job',
        key: 'test-job',
        schedule: '0 0 * * *',
        assertions: ['metric.duration < 5 min'],
        notify: ['devops-alerts']
    });

    const monitors = await cronitor.Monitor.put([
        {
            type: 'check',
            key: 'homepage-check',
            request: {
                url: 'https://example.com',
                regions: ['us-east-1']
            }
        },
        {
            type: 'heartbeat',
            key: 'deployment-heartbeat'
        },
        {
            type: 'errors',
            key: 'billing-error-spikes',
            trigger: 'spike',
            apps: ['app_0123456789abcdef'],
            filters: { env: 'production' },
            threshold: 25,
            window: '5m',
            per: 'fingerprint',
            notify: ['devops-alerts']
        }
    ]);

    await cronitor.Monitor.put({ type: 'job', key: 'test' }, {
        rollback: true,
        format: cronitor.Monitor.requestType.YAML
    });

    void singleMonitor;
    void monitors;
})();

// Test: Event class
const event = new cronitor.Event('event-monitor');
const eventWithOptions = new cronitor.Event('event-monitor', {
    intervalSeconds: 120
});

event.tick();
event.tick(5);
event.error();
(async () => {
    await event.stop();
    await event.fail();
    await event.fail('error message');
})();
void eventWithOptions;

// Test: wrap function (with and without options)
const wrappedFunction = cronitor.wrap('my-job', async () => {
    return 'result';
});
const wrappedSync = cronitor.wrap('my-sync-job', (n: number) => n * 2, {
    captureExceptions: false,
});
(async () => {
    const result: string = await wrappedFunction();
    const doubled: number = await wrappedSync(21);
    void result;
    void doubled;
})();

// Test: Error tracking capture & flush
const capturedErrId: string | null = cronitorWithConfig.captureException(new Error('boom'), {
    monitor: 'import-orders',
    series: 'run-1',
    level: 'error',
    tags: { region: 'us-east-1', retry: 2 },
    extra: { batch: 42 },
    fingerprint: ['import-orders', 'timeout'],
});
const capturedMsgId: string | null = cronitorWithConfig.captureMessage('Disk 90% full', {
    level: 'warning',
    tags: { host: 'worker-1' },
    extra: { mount: '/var' },
    fingerprint: 'disk-space-warning',
});
const monErrId: string | null = monitor.captureException(new Error('bound'));
const monMsgId: string | null = monitor.captureMessage('bound message', { level: 'info' });
void capturedErrId;
void capturedMsgId;
void monErrId;
void monMsgId;

(async () => {
    const drained: boolean = await cronitorWithConfig.flush(1500);
    void drained;
})();

// Test: ErrorApp & ErrorGroup REST API
(async () => {
    const app: Cronitor.ErrorApp = await cronitor.ErrorApp.create({ name: 'Billing API' });
    const dsn: string | undefined = app.dsn;
    const apps: Cronitor.ErrorApp[] = await cronitor.ErrorApp.list({ page: 1, pageSize: 50, autoPaginate: true });
    const existingApp = new cronitor.ErrorApp(app.key);
    await existingApp.loadData();
    await existingApp.update({ name: 'Payments API' });
    await existingApp.rotateKey();
    const deleted: boolean = await existingApp.delete();

    const groups: Cronitor.ErrorGroup[] = await cronitor.ErrorGroup.list({
        app: app.key,
        env: 'production',
        status: 'open',
        level: 'error',
        start: '2026-01-01T00:00:00Z',
        end: '2026-01-02T00:00:00Z',
        q: 'Timeout',
        orderBy: 'last_seen',
        page: 1,
        pageSize: 25,
        autoPaginate: false,
    });
    const group = new cronitor.ErrorGroup('err_0123456789abcdef');
    await group.loadData();
    await group.update({ status: 'resolved', env: 'production' });
    const eventsResp = await group.events({ env: 'production', app: app.key, limit: 25 });
    const singleEvent = await group.event(eventsResp.data[0].event_id);

    void dsn;
    void apps;
    void deleted;
    void groups;
    void singleEvent;
})();

// Test: Config methods
(async () => {
    await cronitor.readConfig({ path: './cronitor.yaml' });
    await cronitor.readConfig({ path: './cronitor.yaml', output: true });
    await cronitor.validateConfig({ path: './cronitor.yaml' });
    await cronitor.applyConfig({ path: './cronitor.yaml' });
    await cronitor.applyConfig({ path: './cronitor.yaml', rollback: true });
    await cronitor.generateConfig({ path: './cronitor.yaml' });
    await cronitor.generateConfig({ path: './cronitor.yaml', group: 'production' });
})();

// Test: newSeries
const series: string = cronitor.newSeries();
void series;

// Test: wraps
const nodeCron = require('node-cron');
cronitor.wraps(nodeCron);
if (cronitor.schedule) {
    cronitor.schedule('job-key', '*/5 * * * *', () => {
        console.log('job running');
    });
}

// Test: Error classes should be accessible
const error1: Cronitor.MonitorNotCreated = new Cronitor.MonitorNotCreated('test');
const error2: Cronitor.ConfigError = new Cronitor.ConfigError('test');
const error3: Cronitor.InvalidMonitor = new Cronitor.InvalidMonitor('test');
const error4: Cronitor.ErrorAppNotFound = new Cronitor.ErrorAppNotFound('test');
const error5: Cronitor.ErrorGroupNotFound = new Cronitor.ErrorGroupNotFound('test');
void error1;
void error2;
void error3;
void error4;
void error5;

console.log('✓ TypeScript compilation successful - all types are valid!');
