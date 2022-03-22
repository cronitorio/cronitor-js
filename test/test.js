const { config } = require('process')

const Monitor = require('../lib/monitor')
, Errors = require('../lib/errors')
, nock = require('nock')
, chai = require('chai')
, sinon = require('sinon')
, sinonChai = require("sinon-chai")
, sinonStubPromise = require('sinon-stub-promise')
, expect = chai.expect


sinonStubPromise(sinon)
chai.use(sinonChai)

const cronitor = require('../lib/cronitor')('apiKey123')

describe('Config Parser', function() {
    context('readConfig', function() {

        it('should raise an error when no path to config is set', function() {
            expect(function() { cronitor.readConfig() }).to.throw("Must include a path to config file e.g. cronitor.readConfig('./cronitor.yaml')")
        })

        it('should return a valid config doc as JSON', function() {
            cronitor.readConfig('./test/cronitor.yaml')
            expect(Object.keys(cronitor.config)).to.include('monitors')
        })

        it('should return monitors with keys and types', function () {
            let config = cronitor.readConfig('./test/cronitor.yaml', true)
            config.monitors.forEach(m => {
                expect(m.key).to.be
                expect(m.type).to.be
            })
        })
    })

    context('validateConfig', function() {
        afterEach(function() {
            sinon.restore()
        })
        it('should call Monitor.put with array of monitors and rollback: true', async function () {
            let stub = sinon.stub(cronitor.Monitor, 'put')
            cronitor.readConfig('./test/cronitor.yaml')
            await cronitor.validateConfig()
            expect(stub).to.be.calledWith(sinon.match.array, true)
        })
    })

    context('applyConfig', function() {
        afterEach(function() {
            sinon.restore()
        })
        it('should call Monitor.put with array of monitors and rollback: false', async function () {
            let stub = sinon.stub(cronitor.Monitor, 'put')
            cronitor.readConfig('./test/cronitor.yaml')
            await cronitor.applyConfig()
            expect(stub).to.be.calledWith(sinon.match.array, false)
        })
    })


    context('generateConfig', function() {
        it('should throw a not implemented error', function() {
            expect(function() { cronitor.generateConfig()}).to.throw
        })
    })
})

describe('Telemetry API', function() {
    const monitor = new cronitor.Monitor('monitor-key')
    const validParams = {
        message: "hello there",
        metrics: {
            count: 1,
            error_count: 1,
            duration: 100,
        },
        env: "production",
        host: '10-0-0-223',
        series: 'world',
    }


    Object.values(cronitor.Monitor.State).forEach((state) => {
        context(`Ping ${state.toUpperCase()}`, function() {

            afterEach(function() {
                sinon.restore()
            })

            it(`calls ${state} correctly`, function(done) {
                let pingStub =  sinon.stub(cronitor._api.axios, 'get')
                monitor.ping({state})
                expect(pingStub).to.be.called
                done()
            })

            it(`calls ${state} correctly with all params`, function(done) {
                let pingStub = sinon.stub(cronitor._api.axios, 'get')
                monitor.ping({state, ...validParams})

                let params = Object.assign({}, {state, ...validParams})

                expect(pingStub).to.be.calledWith(
                    monitor._api.pingUrl(monitor.key),
                    { params, paramsSerializer: sinon.match.any})
                done()
            })
        })
    })
})

describe("Monitor", function() {

    afterEach(function() {
        sinon.restore()
    })

    it('should raise an exception when no key is provided', function() {
        expect(function() { new cronitor.Monitor() }).to.throw()
    })

    it('should pause', function(done) {
        let monitor = new cronitor.Monitor('a-key')
        let stub = sinon.stub(monitor._api.axios, 'get')
        monitor.pause(1000)
        expect(stub).to.be.calledWith(`${monitor._api.monitorUrl(monitor.key)}/pause/1000`)
        done()
    })

    it('should unpause', function(done) {
        let monitor = new cronitor.Monitor('a-key')
        let stub = sinon.stub(monitor._api.axios, 'get')
        monitor.unpause()
        expect(stub).to.be.calledWith(`${monitor._api.monitorUrl(monitor.key)}/pause/0`)
        done()
    })

    it('should reset to ok', function(done) {
        let monitor = new cronitor.Monitor('a-key')
        let stub = sinon.stub(monitor._api.axios, 'get')
        monitor.ok()
        expect(stub).to.be.calledWith(`${monitor._api.pingUrl(monitor.key)}`)
        done()
    })
})

describe("Event", function(done) {
  let event, clock

  beforeEach(function() {
    clock = sinon.useFakeTimers();
    event = new cronitor.Event('monitor-key')
  })

  afterEach(function() {
    clock.restore()
  })

    context("constructor", function() {
        it("should set initial values", function() {
            expect(event._state.count).to.eq(0)
            expect(event.monitor).to.be.instanceOf(Monitor)
            expect(event.intervalSeconds).to.eq(60)
            expect(event.intervalId).to.exist
        })


        it("should set intervalSeconds to provided value", function() {
            event = new cronitor.Event('monitor-key', {intervalSeconds: 30})
            expect(event.intervalSeconds).to.eq(30)
        })

        context("when no key is provided", function() {
            it("should raise an exception if a key is not provided", function() {
                let fnc = function() { new cronitor.Event() }
                expect(fnc).to.throw("You must initialize Event with a key.")
            })
        })
    })

    context("tick", function() {
        it("should increase the called count", function() {
            expect(event._state.count).to.eq(0)
            event.tick()
            expect(event._state.count).to.eq(1)
            event.tick()
            expect(event._state.count).to.eq(2)
            event.tick(0)
            expect(event._state.count).to.eq(2)
            event.tick(5)
            expect(event._state.count).to.eq(7)
        })
    })

    context("stop", function() {
        it("should clear the intervalId", function() {
            event.stop()
            expect(event.intervalId).to.not.exist
        })

        context("when there are unsynced calls", function() {
            it("should call _flush", function() {
                let spy = sinon.spy(event, '_flush')
                event.tick()
                event.stop()
                expect(spy.calledOnce).to.be.true
            })
        })
    })

    context("fail", function() {
        afterEach(function() {
            sinon.restore()
        })
        it("should stop then ping fail", function() {
            let stop = sinon.spy(event, 'stop')
            let ping = sinon.stub(event.monitor, 'ping')
            event.fail()
            expect(stop).to.be.calledOnce
            expect(ping).to.be.calledTwice
        })
    })

    context("_flush", function() {
        afterEach(function() {
            sinon.restore()
        })

        it("should ping tick with number of calls since last tick", function() {
            let ping = sinon.stub(event.monitor, 'ping')
            event.tick()
            event._flush()
            expect(ping).to.have.been.calledWith({metrics: {count: 1, duration: event.intervalSeconds, error_count: 0}})
        })

        it("should ping tick with number of errors reported", function() {
            let ping = sinon.stub(event.monitor, 'ping')
            event.error()
            event._flush()
            expect(ping).to.have.been.calledWith({metrics: {count: 0, duration: event.intervalSeconds, error_count: 1}})
        })

        it("should reset the count and errorCount", function() {
            let stub = sinon.stub(event.monitor, 'ping')
            event.tick()
            expect(event._state.count).to.eq(1)
            event.error()
            expect(event._state.errorCount).to.eq(1)
            event._flush()
            expect(event._state.count).to.eq(0)
            expect(event._state.errorCount).to.eq(0)
        })
    })

})

// describe("test wrap cron", function() {
//     it("should load the node-cron library and define the wrapper function", function() {
//         cronitor.wraps(require('node-cron'))

//         cronitor.schedule('everyMinuteJob', '* * * * *', function() {
//             return new Promise(function(resolve) {
//                 setTimeout(function() {
//                     console.log('running node-cron every min')
//                     resolve("i ran for 10 seconds")
//                 }, 3000)
//             })
//         })

//     })

//     it("should load the NodeCron library and define the wrapper function", function() {
//         cronitor.wraps(require('cron'))

//         cronitor.schedule('everyMinuteJob', '* * * * *', function() {
//             console.log('running cron every min')
//             return "i ran for 10 seconds"
//         })

//     })
// })