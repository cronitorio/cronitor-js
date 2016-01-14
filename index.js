var https = require('https')
var querystring = require('querystring')
var cronitorUrl = 'https://cronitor.link'
var noop = function () {}

module.exports = function (authKey) {
  return {
    run: function (id) {
      var urlObj = buildUrlObj('run', id, authKey)
      getWithTimeout(buildUrl(urlObj))
    },
    complete: function (id) {
      var urlObj = buildUrlObj('complete', id, authKey)
      getWithTimeout(buildUrl(urlObj))
    },
    fail: function (id, msg) {
      var urlObj = buildUrlObj('fail', id, authKey)
      if (msg) {
        if (!urlObj.qs) {
          urlObj.qs = {}
        }
        urlObj.qs.msg = msg
      }
      getWithTimeout(buildUrl(urlObj))
    }
  }
}

function getWithTimeout (url) {
  var req = https.get(url, noop)
  req.setTimeout((10 * 1000), noop)
}

function buildUrlObj (pingUrl, id, authKey) {
  var urlObj = {
    basePath: cronitorUrl + '/' + id + '/' + pingUrl
  }
  if (authKey) {
    urlObj.qs = {
      auth_key: authKey
    }
  }
  return urlObj
}

function buildUrl (urlObj) {
  var url = urlObj.basePath + (urlObj.qs ? '?' + querystring.stringify(urlObj.qs) : '')
  return url
}
