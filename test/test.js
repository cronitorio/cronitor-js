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
        });
        it('should call Monitor.put with a YAML payload and rollback: true', async () => {
            const stub = sinon.stub(cronitor.Monitor, 'put');
            await cronitor.readConfig({path: './test/cronitor.yaml'});
            await cronitor.validateConfig();
            expect(stub).to.be.calledWith(sinon.match.string, { rollback: true, format: Monitor.requestType.YAML});
        });
    });

    context('applyConfig', () => {
        afterEach(async () => {
            sinon.restore();            
        });

        it('should call Monitor.put with array of monitors and rollback: false', async () => {
            const stub = sinon.stub(cronitor.Monitor, 'put');
            await cronitor.readConfig({path: './test/cronitor.yaml'});
            await cronitor.applyConfig();
            expect(stub).to.be.calledWith(sinon.match.string, { rollback: false, format: Monitor.requestType.YAML});
        });
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

// describe('test wrap cron', () => {
//     it('should load the node-cron library and define the wrapper function', () => {
//         cronitor.wraps(require('node-cron'));

//         cronitor.schedule('everyMinuteJob', '* * * * *', () => {
//             return new Promise(function(resolve) {
//                 setTimeout(() => {
//                     console.log('running node-cron every min');
//                     resolve('i ran for 10 seconds');
//                 }, 3000);
//             });
//         });

//     });

//     it('should load the NodeCron library and define the wrapper function', () => {
//         cronitor.wraps(require('cron'));

//         cronitor.schedule('everyMinuteJob', '* * * * *', () => {
//             console.log('running cron every min');
//             return 'i ran for 10 seconds';
//         });

//     });
// });