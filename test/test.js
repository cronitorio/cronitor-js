/* global describe it beforeEach */
var querystring = require('querystring')
var proxyquire = require('proxyquire')
var sinon = require('sinon')
var chai = require('chai')
var expect = chai.expect
var nock = require('nock')

var authKey = '12345'
var authQs = '?auth_key=' + authKey
var dummyCode = 'd3x0c1'
var baseUrl = 'https://cronitor.link'
var monitorApiKey = '1337hax0r'

var getSpy = sinon.spy(function () {
  return {setTimeout: function () {}}
})

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


describe('Ping API', function () {
  var Cronitor = proxyquire('../index', {'request': {'get': getSpy}})
  var cronitorNoAuth = new Cronitor({code: dummyCode})
  var cronitorAuth = new Cronitor({code: dummyCode, authKey: authKey})

  beforeEach(function () {
    getSpy.reset()
  })

  it('no auth calls run correctly', function () {
    cronitorNoAuth.run()
    expect(getSpy.calledWith(baseUrl + '/' + dummyCode + '/run')).to.be.true
  })
  it('no auth calls complete correctly', function () {
    cronitorNoAuth.complete()
    expect(getSpy.calledWith(baseUrl + '/' + dummyCode + '/complete')).to.be.true
  })
  it('no auth calls pause correctly', function () {
    cronitorNoAuth.pause(5)
    expect(getSpy.calledWith(baseUrl + '/' + dummyCode + '/pause/5')).to.be.true
  })
  it('no auth calls unpause correctly', function () {
    cronitorNoAuth.unpause()
    expect(getSpy.calledWith(baseUrl + '/' + dummyCode + '/pause/0')).to.be.true
  })
  it('no auth calls fail correctly no message', function () {
    cronitorNoAuth.fail()
    expect(getSpy.calledWith(baseUrl + '/' + dummyCode + '/fail')).to.be.true
  })
  it('no auth calls fail correctly with message', function () {
    var msg = 'a message'
    cronitorNoAuth.fail(msg)
    expect(getSpy.calledWith(baseUrl + '/' + dummyCode + '/fail?msg=' + querystring.escape(msg))).to.be.true
  })
  it('authed calls run correctly', function () {
    cronitorAuth.run()
    expect(getSpy.calledWith(baseUrl + '/' + dummyCode + '/run' + authQs)).to.be.true
  })
  it('authed calls complete correctly', function () {
    cronitorAuth.complete()
    expect(getSpy.calledWith(baseUrl + '/' + dummyCode + '/complete' + authQs)).to.be.true
  })
  it('authed calls pause correctly', function () {
    cronitorAuth.pause(5)
    expect(getSpy.calledWith(baseUrl + '/' + dummyCode + '/pause/5' + authQs)).to.be.true
  })
  it('authed calls unpause correctly', function () {
    cronitorAuth.unpause()
    expect(getSpy.calledWith(baseUrl + '/' + dummyCode + '/pause/0' + authQs)).to.be.true
  })
  it('authed calls fail correctly no message', function () {
    cronitorAuth.fail()
    expect(getSpy.calledWith(baseUrl + '/' + dummyCode + '/fail' + authQs)).to.be.true
  })
  it('authed calls fail correctly with message', function () {
    var msg = 'a message'
    cronitorAuth.fail(msg)
    expect(getSpy.calledWith(baseUrl + '/' + dummyCode + '/fail' + authQs + '&msg=' + querystring.escape(msg))).to.be.true
  })
})


describe("Monitor API ", function () {
  var Cronitor = require('../index')
  var existingMonitorCode = null
  var cronitor = null

  describe("Create Monitor", function() {
    context("with a valid monitorApiKey", function() {
      var callback = null

      beforeEach(function(done){
        callback = sinon.spy()
        nock('https://cronitor.io')
          .post('/v3/monitors')
          .reply(201, {...newMonitorFixture, code: dummyCode})

        cronitor = new Cronitor({monitorApiKey: monitorApiKey})
        done()
      })

      it("should create a monitor", function(done) {
        cronitor.create(newMonitorFixture, function(err, body) {
          callback(err, body)
          expect(callback.calledOnce).to.be.true
          expect(callback.calledWith(null, body)).to.be.true

          expect(callback.lastCall.args[1]).to.be.a('object')
          expect(callback.lastCall.args[1]['code']).to.equal(dummyCode)
          done()
        })
      })
    })

    context("without a monitorApiKey", function(done) {
      var cronitor = new Cronitor({code: dummyCode})

      it("should raise an exception", function (done) {
        expect(function() {
          cronitor.create(newMonitorFixture, function(err, body) {}).to.throw(new Error("You must provide a monitorApiKey to create a monitor."))
        })
        done()
      })
    })
  })


  describe("Retrieve Monitors", function() {
    describe("List", function() {
      var cronitor, callback

      context("with a valid monitorApiKey", function() {
        beforeEach(function(done) {
          callback = sinon.spy()
          nock('https://cronitor.io')
            .get('/v3/monitors')
            .reply(200, {monitors: [{...newMonitorFixture, code: dummyCode}]})

          cronitor = new Cronitor({monitorApiKey: monitorApiKey})
          done()
        })

        it("should retrieve a list of monitors", function(done) {
          cronitor.all(function(err, body) {
            callback(err, body)
            expect(callback.calledOnce).to.be.true
            expect(callback.calledWith(null, body)).to.be.true

            // TODO check that body is the api response
            expect(callback.lastCall.args[1]).to.be.a('object')
            expect(callback.lastCall.args[1]['monitors'].length).to.equal(1)
            done()
          })
        })

        // TODO check page param is properly represented in the request
        // it("should fetch the specified page of data", function(done) {
        //   cronitor.all(function(err, body) {
        //     callback(err, body)
        //     expect(callback.calledOnce).to.be.true
        //     done()
        //   })
        // })
      })

      context("with no monitorApiKey", function() {
        cronitor = new Cronitor({code: dummyCode})

        it("should raise an exception", function (done) {
          expect(function() {
            cronitor.all(function(err, body) {}).to.throw(new Error("You must provide a monitorApiKey to list your monitors."))
          })
          done()
        })
      })
    })

    describe("Individual", function() {
      var cronitor, callback
      context("with a valid monitorApiKey", function() {
        beforeEach(function(done) {
          callback = sinon.spy()
          nock('https://cronitor.io')
            .get('/v3/monitors/' + dummyCode)
            .reply(200, {...newMonitorFixture, code: dummyCode})
          done()
        })

        it("should retrieve a monitor", function(done) {
          cronitor = new Cronitor({monitorApiKey: monitorApiKey})
          cronitor.get(dummyCode, function(err, body) {
            callback(err, body)
            expect(callback.calledOnce).to.be.true
            expect(callback.calledWith(null, body)).to.be.true

            // TODO check that body is the api response
            expect(callback.lastCall.args[1]).to.be.a('object')
            expect(callback.lastCall.args[1]['monitors'].length).to.equal(1)
            done()
          })
        })
      })

      context("with no monitorApiKey", function() {
        cronitor = new Cronitor({code: dummyCode})
        it("should raise an exception", function (done) {
          expect(function() {
            cronitor.all(function(err, body) {}).to.throw(new Error("You must provide a monitorApiKey to list your monitors."))
          })
          done()
        })
      })
    })
  })


  describe("Update Monitor", function() {
    context("with monitorApiKey", function() {
      context("and monitor code", function() {
        var callback = null

        beforeEach(function(done){
          callback = sinon.spy()
          nock('https://cronitor.io')
            .put('/v3/monitors/'+ dummyCode)
            .reply(200, {...newMonitorFixture, code: dummyCode})
          done()
        })

        it("should update a monitor", function(done) {
          var cronitor = new Cronitor({monitorApiKey: monitorApiKey, code: dummyCode})
          cronitor.update(newMonitorFixture, function(err, body) {
            callback(err, body)
            expect(callback.calledOnce).to.be.true
            expect(callback.calledWith(null, body)).to.be.true

            expect(callback.lastCall.args[1]).to.be.a('object')
            expect(callback.lastCall.args[1]['code']).to.equal(dummyCode)
            done()
          })
        })
      })

      context("and without monitor code", function(done) {
        var cronitor = new Cronitor({monitorApiKey: monitorApiKey})
        it("should raise an exception", function (done) {
          expect(function() {
            cronitor.update({}, function(err, body) {}).to.throw(new Error("You must provide a monitor code to update a monitor."))
          })
          done()
        })
      })
    })

    context("without monitorApiKey", function(done) {
      var cronitor = new Cronitor({code: dummyCode})
      it("should raise an exception", function (done) {
        expect(function() {
          cronitor.update({}, function(err, body) {}).to.throw(new Error("You must provide a monitorApiKey to update a monitor."))
        })
        done()
      })
    })
  })


  describe("Delete Monitor", function() {
    context("with monitorApiKey", function() {
      context("and monitor code", function() {
        var callback = null

        beforeEach(function(done){
          callback = sinon.spy()
          nock('https://cronitor.io')
            .delete('/v3/monitors/'+ dummyCode)
            .reply(204)
          done()
        })

        it("should delete a monitor", function(done) {
          var cronitor = new Cronitor({monitorApiKey: monitorApiKey, code: dummyCode})
          cronitor.delete(function(err, body) {
            callback(err, body)
            expect(callback.calledOnce).to.be.true
            done()
          })
        })
      })

      context("and without monitor code", function(done) {
        var cronitor = new Cronitor({monitorApiKey: monitorApiKey})
        it("should raise an exception", function (done) {
          expect(function() {
            cronitor.delete({}, function(err, body) {}).to.throw(new Error("You must provide a monitor code to delete a monitor."))
          })
          done()
        })
      })
    })

    context("without monitorApiKey", function(done) {
      var cronitor = new Cronitor({code: dummyCode})
      it("should raise an exception", function (done) {
        expect(function() {
          cronitor.delete({}, function(err, body) {}).to.throw(new Error("You must provide a monitorApiKey to delete a monitor."))
        })
        done()
      })
    })
  })

})
