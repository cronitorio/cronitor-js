/* global describe it beforeEach */
var querystring = require('querystring')
var proxyquire = require('proxyquire')
var sinon = require('sinon')
var httpsSpy = sinon.spy()

var authKey = '12345'
var authQs = '?auth_key=' + authKey
var eventKey = 'foo'
var baseUrl = 'https://cronitor.link'

var cronitorNoAuth = proxyquire('../index', {'https': {'get': httpsSpy}})()

var cronitorAuth = proxyquire('../index', {'https': {'get': httpsSpy}})(authKey)

describe('#cronitor', function () {
  beforeEach(function () {
    httpsSpy.reset()
  })

  it('no auth calls run correctly', function () {
    cronitorNoAuth.run(eventKey)
    httpsSpy.calledWithExactly(baseUrl + '/' + eventKey + '/run').should.equal(true)
  })
  it('no auth calls complete correctly', function () {
    cronitorNoAuth.complete(eventKey)
    httpsSpy.calledWithExactly(baseUrl + '/' + eventKey + '/complete').should.equal(true)
  })
  it('no auth calls fail correctly no message', function () {
    cronitorNoAuth.fail(eventKey)
    httpsSpy.calledWithExactly(baseUrl + '/' + eventKey + '/fail').should.equal(true)
  })
  it('no auth calls fail correctly with message', function () {
    var msg = 'a message'
    cronitorNoAuth.fail(eventKey, msg)
    httpsSpy.calledWithExactly(baseUrl + '/' + eventKey + '/fail?msg=' + querystring.escape(msg)).should.equal(true)
  })
  it('no auth calls pause correctly', function () {
    cronitorNoAuth.pause(eventKey, 5)
    httpsSpy.calledWithExactly(baseUrl + '/' + eventKey + '/pause/5').should.equal(true)
  })
  it('authed calls run correctly', function () {
    cronitorAuth.run(eventKey)
    httpsSpy.calledWithExactly(baseUrl + '/' + eventKey + '/run' + authQs).should.equal(true)
  })
  it('authed calls complete correctly', function () {
    cronitorAuth.complete(eventKey)
    httpsSpy.calledWithExactly(baseUrl + '/' + eventKey + '/complete' + authQs).should.equal(true)
  })
  it('authed calls fail correctly no message', function () {
    cronitorAuth.fail(eventKey)
    httpsSpy.calledWithExactly(baseUrl + '/' + eventKey + '/fail' + authQs).should.equal(true)
  })
  it('authed calls fail correctly with message', function () {
    var msg = 'a message'
    cronitorAuth.fail(eventKey, msg)
    httpsSpy.calledWithExactly(baseUrl + '/' + eventKey + '/fail' + authQs + '&msg=' + querystring.escape(msg)).should.equal(true)
  })
  it('authed calls pause correctly', function () {
    cronitorAuth.pause(eventKey, 5)
    httpsSpy.calledWithExactly(baseUrl + '/' + eventKey + '/pause/5' + authQs).should.equal(true)
  })
  it('pause throws when no hour is supplied', function () {
    var caught = false
    try {
      cronitorAuth.pause(eventKey)
    } catch (e) {
      caught = true
    }
    caught.should.equal(true)
  })
})
