var querystring = require('querystring')
var nock = require('nock')
var chai = require('chai')

var Cronitor = require('../index')
var expect = chai.expect
var authKey = '12345'
var authQs = '?auth_key=' + authKey
var msg = 'a message'
var timestamp = Date.now() / 1000;
var dummyCode = 'd3x0c1'
var baseUrl = 'https://cronitor.link'
var monitorApiKey = '1337hax0r'
var newMonitorFixture = {
  "name": "Testing_Cronitor_Client",
  "notifications": {
      "phones": [],
      "webhooks": [],
      "emails": [
          "support@example.com"
      ]
  },
  "rules": [
      {
          "rule_type": "not_run_in",
          "duration": 1,
          "time_unit": "minutes"
      },
      {
          "rule_type": "ran_longer_than",
          "duration": 1,
          "time_unit": "minutes"
      }
  ],
  "note": "Created by cronitor.io node.js client: version 2"
}

describe('Ping API', function() {
  var cronitor = new Cronitor({code: dummyCode})
  var cronitorAuthed = new Cronitor({code: dummyCode, authKey: authKey})
  var endpoints = ['run', 'complete', 'fail']

  endpoints.forEach((endpoint) => {
    context(`${endpoint.toUpperCase()} Endpoint`, function() {
      beforeEach(function(done) {
        nock(baseUrl)
          .get(`/${dummyCode}/${endpoint}`)
          .reply(200)
          .get(`/${dummyCode}/${endpoint}?msg=${msg}`)
          .reply(200)
          .get(`/${dummyCode}/${endpoint}?msg=${msg}&stamp=${timestamp}`)
          .reply(200)
          .get(`/${dummyCode}/${endpoint}?auth_key=${authKey}`)
          .reply(200)

        done()
      })

      it(`calls ${endpoint} correctly`, function(done) {
        cronitor[endpoint]().then((res) => {
          expect(res.status).to.eq(200)
          done()
        })
      })

      it(`calls ${endpoint} correctly with message`, function(done) {
        cronitor[endpoint](msg).then((res) => {
          expect(res.status).to.eq(200)
          expect(res.config.url).to.contain(`?msg=a%20message`)
          done()
        })
      })

      it(`calls ${endpoint} correctly with stamp`, function(done) {
        cronitor[endpoint](msg, timestamp).then((res) => {
          expect(res.status).to.eq(200)
          expect(res.config.url).to.contain(`?msg=a%20message&stamp=${timestamp}`)
          done()
        })
      })

      it(`authed calls ${endpoint} correctly`, function(done) {
        cronitorAuthed[endpoint]().then((res) => {
          expect(res.status).to.eq(200)
          expect(res.config.url).to.contain(`?auth_key=${authKey}`)
          done()
        })
      })
    })
  })

  context("Pause Endpoint", function() {
    it('calls pause correctly', function(done) {
      nock(baseUrl)
          .get(`/${dummyCode}/pause/5`)
          .reply(200)

      cronitor.pause(5).then((res) => {
        expect(res.status).to.eq(200)
        done()
      })
    })

    it('calls unpause correctly', function(done) {
      nock(baseUrl)
          .get(`/${dummyCode}/pause/0`)
          .reply(200)

      cronitor.unpause().then((res) => {
        expect(res.status).to.eq(200)
        done()
      })
    })

    it('authed calls pause correctly', function(done) {
      nock(baseUrl)
         .get(`/${dummyCode}/pause/5?auth_key=${authKey}`)
          .reply(200)

        cronitorAuthed.pause(5).then((res) => {
        expect(res.status).to.eq(200)
        done()
      })
    })

    it('authed calls unpause correctly', function(done) {
      nock(baseUrl)
          .get(`/${dummyCode}/pause/0?auth_key=${authKey}`)
          .reply(200)
      cronitorAuthed.unpause().then((res) => {
        expect(res.status).to.eq(200)
        done()
      })
    })
  })
})


// run integration tests against a production account
if (process.env.MONITOR_API_KEY) {
  describe("Integration Tests", function() {
    var cronitor = new Cronitor({monitorApiKey: process.env.MONITOR_API_KEY})
    var cronMonitor = {
      "name": "Testing_Cronitor_Client_Cron",
      "type": "cron",
      "rules": [
          {
            "rule_type": "not_on_schedule",
            "value": '0 0 * * *',
          }
      ]
    }
    var heartbeatMonitor = {
      "name": "Testing_Cronitor_Client_Heartbeat",
      "type": "heartbeat_v2",
      "rules": [
        {
          "rule_type": "not_run_in",
          "value": "1",
          "time_unit": "hours"
        }
      ]
    }

    it ("should create a heartbeat monitor and delete it", function(done) {
      cronitor.create(heartbeatMonitor)
        .then((res) => {
          expect(res.code).not.to.be.null
          expect(res.type).to.eq(heartbeatMonitor.type)
          cronitor.delete()
          done()
        })
        .catch((err) => {
          console.log(err)
        })
    })

    it ("should create a cron monitor and delete it", function(done) {
      cronitor.create(cronMonitor)
        .then((res) => {
          expect(res.code).not.to.be.null
          expect(res.type).to.eq(cronMonitor.type)
          cronitor.delete()
          done()
        })
        .catch((err) => {
          console.log(err)
        })
    })

    it("should create a cron monitor with the sugar syntax", function(done) {
      cronitor.createCron({
        expression: '0 0 * * *',
        name: 'Testing_Cronitor_Client_SugarCron',
        notificationLists: ['site-emergency'],
        graceSeconds: 60
      })
      .then((res) => {
        expect(res.code).not.to.be.null
        expect(res.rules[0].rule_type).to.eq('not_on_schedule')
        expect(res.rules[0].value).to.eq('0 0 * * *')
        cronitor.delete()
        done()
      })
      .catch((err) => {
        console.log(err)
      })
    })

    it("should create a heartbeat monitor with the every syntax", function(done) {
      cronitor.createHeartbeat({
        name: "Queue Worker Heartbeat",
        every: [5, 'minutes'],
        notificationLists: ['site-emergency'],
        graceSeconds: 60
      })
      .then((res) => {
        expect(res.code).not.to.be.null
        expect(res.rules[0].rule_type).to.eq('run_ping_not_received')
        expect(res.rules[0].value).to.eq(5)
        expect(res.rules[0].grace_seconds).to.eq(60)
        cronitor.delete()
        done()
      })
      .catch((err) => {
        console.log(err)
      })
    })

    it("should create a heartbeat monitor with the at syntax", function(done) {
      cronitor.createHeartbeat({
        name: "Not pinged at 12:05",
        at: '00:00',
        notificationLists: ['site-emergency'],
        graceSeconds: 60
      })
      .then((res) => {
        expect(res.code).not.to.be.null
        expect(res.rules[0].rule_type).to.eq('run_ping_not_received_at')
        expect(res.rules[0].value).to.eq('00:00')
        cronitor.delete()
        done()
      })
      .catch((err) => {
        console.log(err)
      })
    })
  })
} else {
  describe("Monitor API ", function() {
    var existingMonitorCode = null
    var cronitor = null

    describe("Create Monitor", function() {
      context("with a valid monitorApiKey", function() {
        var cronitor = new Cronitor({monitorApiKey: monitorApiKey})

        it("should create a monitor", function(done) {
          nock('https://cronitor.io')
            .post('/v3/monitors')
            .reply(201, {...newMonitorFixture, code: dummyCode})

            cronitor.create(newMonitorFixture).then((res) => {
            expect(res['code']).to.eq(dummyCode)
            done()
          })
        })

        context("with an invalid monitor payload", function() {
          it("should return a validation error", function() {
            var invalidPayload = {...newMonitorFixture}
            delete invalidPayload['rules']
            nock('https://cronitor.io')
              .post('/v3/monitors')
              .reply(400, {"name": ["Name is required"]})

            cronitor.create(newMonitorFixture)
              .then((res) => { })
              .catch((err) => {
                expect(err.status).to.eq(400)
                expect(err.data).to.eq({'name:': ["Name is required"]})
              })
          })
        })
      })

      context("without a monitorApiKey", function(done) {
        var cronitor = new Cronitor({code: dummyCode})

        it("should raise an exception", function (done) {
          expect(function() {
            cronitor.create(newMonitorFixture).to.throw(new Error("You must provide a monitorApiKey to create a monitor."))
          })
          done()
        })
      })
    })


    describe("Retrieve Monitors", function() {
      describe("List", function() {
        var cronitor

        context("with a valid monitorApiKey", function() {
          beforeEach(function(done) {
            cronitor = new Cronitor({monitorApiKey: monitorApiKey})
            done()
          })

          it("should retrieve a list of monitors", function(done) {
            nock('https://cronitor.io')
              .get('/v3/monitors')
              .reply(200, {monitors: [{...newMonitorFixture, code: dummyCode}, {...newMonitorFixture, code: "foo"}]})

            cronitor.filter().then((res) =>{
              expect(res.monitors.length).to.eq(2)
              expect(res.monitors[0].code).to.eq(dummyCode)
              expect(res.monitors[1].code).to.eq("foo")
              done()
            })
          })

          it("should fetch the specified page of data", function(done) {
            nock('https://cronitor.io')
              .get('/v3/monitors?page=2')
              .reply(200, {page: 2, monitors: [{...newMonitorFixture, code: dummyCode}, {...newMonitorFixture, code: "foo"}]})

            cronitor.filter({page: 2}).then((res) => {
              expect(res.page).to.eq(2)
              expect(res.monitors.length).to.eq(2)
              expect(res.monitors[0].code).to.eq(dummyCode)
              expect(res.monitors[1].code).to.eq("foo")
              done()
            })
          })
        })

        context("with no monitorApiKey", function() {
          cronitor = new Cronitor({code: dummyCode})

          it("should raise an exception", function (done) {
            expect(function() {
              cronitor.filter().to.throw(new Error("You must provide a monitorApiKey to retrieve monitors."))
            })
            done()
          })
        })
      })

      describe("Individual", function() {
        var cronitor
        context("with a valid monitorApiKey", function() {
          beforeEach(function(done) {
            nock('https://cronitor.io')
              .get('/v3/monitors/' + dummyCode)
              .reply(200, {...newMonitorFixture, code: dummyCode})
            done()
          })

          it("should retrieve a monitor", function(done) {
            cronitor = new Cronitor({code: dummyCode, monitorApiKey: monitorApiKey})
            cronitor.get().then((res) => {
              expect(res['code']).to.eq(dummyCode)
              done()
            })

          })
        })

        context("with no monitorApiKey", function() {
          cronitor = new Cronitor({code: dummyCode})
          it("should raise an exception", function (done) {
            expect(function() {
              cronitor.get().to.throw(new Error("You must provide a monitorApiKey to retrieve a monitor."))
            })
            done()
          })
        })
      })
    })


    describe("Update Monitor", function() {
      context("with monitorApiKey", function() {
        context("and monitor code", function() {
          beforeEach(function(done){
            nock('https://cronitor.io')
              .put('/v3/monitors/'+ dummyCode)
              .reply(200, {...newMonitorFixture, code: dummyCode})
            done()
          })

          it("should update a monitor", function(done) {
            var cronitor = new Cronitor({monitorApiKey: monitorApiKey, code: dummyCode})
            cronitor.update(newMonitorFixture).then((res) => {
              expect(res['code']).to.eq(dummyCode)
              done()
            })
          })
        })

        context("and without monitor code", function(done) {
          var cronitor = new Cronitor({monitorApiKey: monitorApiKey})
          it("should raise an exception", function (done) {
            expect(function() {
              cronitor.update({}).to.throw(new Error("You must provide a monitor code to update a monitor."))
            })
            done()
          })
        })
      })

      context("without monitorApiKey", function(done) {
        var cronitor = new Cronitor({code: dummyCode})
        it("should raise an exception", function (done) {
          expect(function() {
            cronitor.update({}).to.throw(new Error("You must provide a monitorApiKey to update a monitor."))
          })
          done()
        })
      })
    })


    describe("Delete Monitor", function() {
      context("with monitorApiKey", function() {
        context("and monitor code", function() {
          beforeEach(function(done){
            nock('https://cronitor.io')
              .delete('/v3/monitors/'+ dummyCode)
              .reply(204)
            done()
          })

          it("should delete a monitor", function(done) {
            var cronitor = new Cronitor({monitorApiKey: monitorApiKey, code: dummyCode})
            cronitor.delete().then((res) => {
              expect(res.status).to.eq(204)
              done()
            })
          })
        })

        context("and without monitor code", function(done) {
          var cronitor = new Cronitor({monitorApiKey: monitorApiKey})
          it("should raise an exception", function (done) {
            expect(function() {
              cronitor.delete().to.throw(new Error("You must provide a monitor code to delete a monitor."))
            })
            done()
          })
        })
      })

      context("without monitorApiKey", function(done) {
        var cronitor = new Cronitor({code: dummyCode})
        it("should raise an exception", function (done) {
          expect(function() {
            cronitor.delete().to.throw(new Error("You must provide a monitorApiKey to delete a monitor."))
          })
          done()
        })
      })
    })
  })
}

