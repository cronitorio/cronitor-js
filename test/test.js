const Monitor = require('../lib/monitor'),
	chai = require('chai'),
	sinon = require('sinon'),
	sinonChai = require('sinon-chai'),
	sinonStubPromise = require('sinon-stub-promise'),
	expect = chai.expect;


sinonStubPromise(sinon);
chai.use(sinonChai);

const cronitor = require('../lib/cronitor')('apiKey123');

describe('Config Parser', () => {
	context('readConfig', () => {

		it('should raise an error when no path to config is set', () => {
			expect(() => { cronitor.readConfig(); }).to.throw('Must include a path to config file e.g. cronitor.readConfig(\'./cronitor.yaml\')');
		});

		it('should return a valid config doc as JSON', () => {
			cronitor.readConfig('./test/cronitor.yaml');
			expect(Object.keys(cronitor.config)).to.include('monitors');
		});

		it('should return monitors with keys and types', () => {
			const config = cronitor.readConfig('./test/cronitor.yaml', true);
			config.monitors.forEach(m => {
				expect(m.key).to.be;
				expect(m.type).to.be;
			});
		});
	});

	context('validateConfig', () => {
		afterEach(() => {
			sinon.restore();
		});
		it('should call Monitor.put with array of monitors and rollback: true', async () => {
			const stub = sinon.stub(cronitor.Monitor, 'put');
			cronitor.readConfig('./test/cronitor.yaml');
			await cronitor.validateConfig();
			expect(stub).to.be.calledWith(sinon.match.array, true);
		});
	});

	context('applyConfig', () => {
		afterEach(() => {
			sinon.restore();
		});
		it('should call Monitor.put with array of monitors and rollback: false', async () => {
			const stub = sinon.stub(cronitor.Monitor, 'put');
			cronitor.readConfig('./test/cronitor.yaml');
			await cronitor.applyConfig();
			expect(stub).to.be.calledWith(sinon.match.array, false);
		});
	});


	context('generateConfig', () => {
		it('should throw a not implemented error', () => {
			expect(() => { cronitor.generateConfig();}).to.throw;
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

// describe("test wrap cron", () => {
//     it("should load the node-cron library and define the wrapper function", () => {
//         cronitor.wraps(require('node-cron'))

//         cronitor.schedule('everyMinuteJob', '* * * * *', () => {
//             return new Promise(function(resolve) {
//                 setTimeout(() => {
//                     console.log('running node-cron every min')
//                     resolve("i ran for 10 seconds")
//                 }, 3000)
//             })
//         })

//     })

//     it("should load the NodeCron library and define the wrapper function", () => {
//         cronitor.wraps(require('cron'))

//         cronitor.schedule('everyMinuteJob', '* * * * *', () => {
//             console.log('running cron every min')
//             return "i ran for 10 seconds"
//         })

//     })
// })