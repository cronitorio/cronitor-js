/* global describe it beforeEach */
var querystring = require('querystring')
var proxyquire = require('proxyquire')
var sinon = require('sinon')

var authKey = '12345'
var authQs = '?auth_key=' + authKey
var eventKey = 'foo'
var baseUrl = 'https://cronitor.link'

var httpsSpy = sinon.spy(function () {
  return {setTimeout: function () {}}
})

var cronitorNoAuth = proxyquire('../index', {'https': {'get': httpsSpy}})()
var cronitorAuth = proxyquire('../index', {'https': {'get': httpsSpy}})(authKey)

describe('#cronitor', function () {
  beforeEach(function () {
    httpsSpy.reset()
  })

  it('no auth calls run correctly', function () {
    cronitorNoAuth.run(eventKey)
    httpsSpy.calledWith(baseUrl + '/' + eventKey + '/run').should.equal(true)
  })
  it('no auth calls complete correctly', function () {
    cronitorNoAuth.complete(eventKey)
    httpsSpy.calledWith(baseUrl + '/' + eventKey + '/complete').should.equal(true)
  })
  it('no auth calls fail correctly no message', function () {
    cronitorNoAuth.fail(eventKey)
    httpsSpy.calledWith(baseUrl + '/' + eventKey + '/fail').should.equal(true)
  })
  it('no auth calls fail correctly with message', function () {
    var msg = 'a message'
    cronitorNoAuth.fail(eventKey, msg)
    httpsSpy.calledWith(baseUrl + '/' + eventKey + '/fail?msg=' + querystring.escape(msg)).should.equal(true)
  })
  it('authed calls run correctly', function () {
    cronitorAuth.run(eventKey)
    httpsSpy.calledWith(baseUrl + '/' + eventKey + '/run' + authQs).should.equal(true)
  })
  it('authed calls complete correctly', function () {
    cronitorAuth.complete(eventKey)
    httpsSpy.calledWith(baseUrl + '/' + eventKey + '/complete' + authQs).should.equal(true)
  })
  it('authed calls fail correctly no message', function () {
    cronitorAuth.fail(eventKey)
    httpsSpy.calledWith(baseUrl + '/' + eventKey + '/fail' + authQs).should.equal(true)
  })
  it('authed calls fail correctly with message', function () {
    var msg = 'a message'
    cronitorAuth.fail(eventKey, msg)
    httpsSpy.calledWith(baseUrl + '/' + eventKey + '/fail' + authQs + '&msg=' + querystring.escape(msg)).should.equal(true)
  })
})
