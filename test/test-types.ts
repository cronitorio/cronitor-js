// TypeScript verification test file
// This file tests that the type definitions work correctly
// Run: npx tsc --noEmit

import Cronitor from '../index';

// Test: Initialize Cronitor
const cronitor = Cronitor('api_key_123');
const cronitorWithConfig = Cronitor('api_key_123', {
    apiVersion: '2020-10-01',
    environment: 'staging',
    timeout: 5000,
    region: 'eu'
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

// Test: Monitor.put
(async () => {
    // Single monitor
    const singleMonitor = await cronitor.Monitor.put({
        type: 'job',
        key: 'test-job',
        schedule: '0 0 * * *',
        assertions: ['metric.duration < 5 min'],
        notify: ['devops-alerts']
    });

    // Multiple monitors
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
        }
    ]);

    // With options
    await cronitor.Monitor.put({ type: 'job', key: 'test' }, {
        rollback: true,
        format: cronitor.Monitor.requestType.YAML
    });
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

// Test: wrap function
const wrappedFunction = cronitor.wrap('my-job', async () => {
    return 'result';
});
(async () => {
    const result: string = await wrappedFunction();
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

console.log('✓ TypeScript compilation successful - all types are valid!');
