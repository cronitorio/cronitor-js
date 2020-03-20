/* global describe it beforeEach */
var querystring = require('querystring')
var proxyquire = require('proxyquire')
var sinon = require('sinon')

var authKey = '12345'
var authQs = '?auth_key=' + authKey
var dummyCode = 'd3x0c1'
var baseUrl = 'https://cronitor.link'
var monitorApiKey = '1337hax0r'

var getSpy = sinon.spy(function () {
  return {setTimeout: function () {}}
})

var postSpy = sinon.spy(function () {
  return {setTimeout: function () {}}
})


var CronitorClient = proxyquire('../index', {'https': {'get': getSpy, 'post': postSpy}, 'request': {'get': getSpy, 'post': postSpy}})
var cronitorNoAuth = new CronitorClient({code: dummyCode})
var cronitorAuth = new CronitorClient({code: dummyCode, authKey: authKey})

describe('Ping API', function () {
  beforeEach(function () {
    getSpy.reset()
  })

  it('no auth calls run correctly', function () {
    cronitorNoAuth.run()
    getSpy.calledWith(baseUrl + '/' + dummyCode + '/run').should.equal(true)
  })
  it('no auth calls complete correctly', function () {
    cronitorNoAuth.complete()
    getSpy.calledWith(baseUrl + '/' + dummyCode + '/complete').should.equal(true)
  })
  it('no auth calls pause correctly', function () {
    cronitorNoAuth.pause(5)
    getSpy.calledWith(baseUrl + '/' + dummyCode + '/pause/5').should.equal(true)
  })
  it('no auth calls unpause correctly', function () {
    cronitorNoAuth.unpause()
    getSpy.calledWith(baseUrl + '/' + dummyCode + '/pause/0').should.equal(true)
  })
  it('no auth calls fail correctly no message', function () {
    cronitorNoAuth.fail()
    getSpy.calledWith(baseUrl + '/' + dummyCode + '/fail').should.equal(true)
  })
  it('no auth calls fail correctly with message', function () {
    var msg = 'a message'
    cronitorNoAuth.fail(msg)
    getSpy.calledWith(baseUrl + '/' + dummyCode + '/fail?msg=' + querystring.escape(msg)).should.equal(true)
  })
  it('authed calls run correctly', function () {
    cronitorAuth.run()
    getSpy.calledWith(baseUrl + '/' + dummyCode + '/run' + authQs).should.equal(true)
  })
  it('authed calls complete correctly', function () {
    cronitorAuth.complete()
    getSpy.calledWith(baseUrl + '/' + dummyCode + '/complete' + authQs).should.equal(true)
  })
  it('authed calls pause correctly', function () {
    cronitorAuth.pause(5)
    getSpy.calledWith(baseUrl + '/' + dummyCode + '/pause/5' + authQs).should.equal(true)
  })
  it('authed calls unpause correctly', function () {
    cronitorAuth.unpause()
    getSpy.calledWith(baseUrl + '/' + dummyCode + '/pause/0' + authQs).should.equal(true)
  })
  it('authed calls fail correctly no message', function () {
    cronitorAuth.fail()
    getSpy.calledWith(baseUrl + '/' + dummyCode + '/fail' + authQs).should.equal(true)
  })
  it('authed calls fail correctly with message', function () {
    var msg = 'a message'
    cronitorAuth.fail(msg)
    getSpy.calledWith(baseUrl + '/' + dummyCode + '/fail' + authQs + '&msg=' + querystring.escape(msg)).should.equal(true)
  })
})


describe("Monitor API ", function () {
  // if( !api_token){
  //   console.log("No access token provided. Please set 'ACCESS_TOKEN' environment variable before running test.")
  //   process.abort()
  // }

  describe("check unauthorized request", function() {
    var cc = new CronitorClient({code: dummyCode})
    beforeEach(function(done) {
      getSpy.reset()
      postSpy.reset()
      done()
    })

    it("should fetch all monitors", function(done){
      cc.all(function(err, body) {})
      getSpy.calledOnce.should.equal(true)
    })
  })


  describe("Authorized requests:" , function(){
    var cc = new CronitorClient({ monitorApiKey: monitorApiKey })
    beforeEach(function(done) {
      getSpy.reset()
      postSpy.reset()
      done()
    })

    it("should fetch all monitors", function(done){
      cc.all(function(err, body) {})
      requestSpy.calledOnce.should.equal(true)
    })
  })

  // describe("CRUD operations: ", function(){

  //   var existingMonitorCode = null
  //   var cc = null
  //   beforeAll( function(done){
  //     cc = new CronitorClient({ access_token: process.env['ACCESS_TOKEN'] })
  //     done()
  //   })

  //   it("- should create new monitor", function(done){
  //     var callback = jasmine.createSpy("callback")
  //     var newMonitor = {
  //         "name": "Testing_Cronitor_Client",
  //         "notifications": {
  //             "phones": [],
  //             "webhooks": [],
  //             "emails": [
  //                 "sonukr666@xyz.com"
  //             ]
  //         },
  //         "rules": [
  //             {
  //                 "rule_type": "not_run_in",
  //                 "duration": 1,
  //                 "time_unit": "minutes"
  //             },
  //             {
  //                 "rule_type": "ran_longer_than",
  //                 "duration": 1,
  //                 "time_unit": "minutes"
  //             }
  //         ],
  //         "note": "Created by cronitor.io node.js client: version 1"
  //     }

  //     cc.new( newMonitor, function(err, body){
  //       callback(err,body)
  //       expect( callback).toHaveBeenCalled()
  //       expect( callback.calls.mostRecent().args[0] ).toBe(null)

  //       expect( typeof callback.calls.mostRecent().args[1]).toBe('object')
  //       if( callback.calls.mostRecent().args[1] ){
  //          existingMonitorCode = callback.calls.mostRecent().args[1]['code']
  //        }

  //       done()
  //     })
  //   })

  //   describe("- Update, unpause and delete monitor", function(){

  //     beforeAll( function(){
  //       if( !existingMonitorCode ){
  //         throw new Error("monitor not created")
  //         process.abort()
  //       }
  //     })


  //     it("- should update monitor", function(done){
  //         var callback = jasmine.createSpy("callback")
  //         var updateMonitor = {
  //             "name": "Testing_Cronitor_Client",
  //             "notifications": {
  //                 "phones": [],
  //                 "webhooks": [],
  //                 "emails": [
  //                     "chantu@xyz.com"
  //                 ]
  //             },
  //             "rules": {
  //               "new" : [
  //                 {
  //                     "rule_type": "not_run_in",
  //                     "duration": 1,
  //                     "time_unit": "minutes"
  //                 },
  //                 {
  //                     "rule_type": "ran_longer_than",
  //                     "duration": 2,
  //                     "time_unit": "minutes"
  //                 }
  //               ]
  //             },
  //             "note": "Created by cronitor.io node.js client: version 2"
  //         }

  //         cc.update( existingMonitorCode, updateMonitor, function(err, body){
  //           callback(err,body)
  //           expect( callback).toHaveBeenCalled()
  //           expect( callback.calls.mostRecent().args[0] ).toBe(null)
  //           expect( typeof callback.calls.mostRecent().args[1]).toBe('object')
  //           done()
  //         })
  //     })


  //     it("- should unpause monitor", function(done){
  //       var callback = jasmine.createSpy("callback")

  //       cc.unpause( existingMonitorCode, function(err, body){
  //         callback(err,body)
  //         expect( callback).toHaveBeenCalled()
  //         expect( callback.calls.mostRecent().args[0] ).toBe(null)
  //         expect( typeof callback.calls.mostRecent().args[1]).toBe('string')
  //         done()
  //       })
  //     })


  //     it("- should delete monitor", function(done){

  //       var callback = jasmine.createSpy("callback")
  //       cc.delete( existingMonitorCode, function(err, body){
  //         callback(err,body)
  //         if( err){
  //           conosole.log("Please delete the monitor manually: 'Testing_Cronitor_Client'")
  //         }
  //         expect( callback).toHaveBeenCalled()
  //         expect( callback.calls.mostRecent().args[0] ).toBe(null)
  //         done()
  //       })
  //     })

  //   })
  // })
})
