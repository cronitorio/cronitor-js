var https = require('https')
var querystring = require('querystring')
var cronitorUrl = 'https://cronitor.link'
// the pause url redirects to the main url
// and including a url dependency felt like too much
var cronitorPauseUrl = 'https://cronitor.io'
var noop = function () {}

module.exports = function (authKey) {
  return {
    run: function (id) {
      var urlObj = buildUrlObj(cronitorUrl, 'run', id, authKey)
      getWithTimeout(buildUrl(urlObj))
    },
    complete: function (id) {
      var urlObj = buildUrlObj(cronitorUrl, 'complete', id, authKey)
      getWithTimeout(buildUrl(urlObj))
    },
    pause: function (id, hours) {
      var urlObj = buildUrlObj(cronitorPauseUrl, 'pause', id, authKey)
      urlObj.basePath = urlObj.basePath + '/' + hours
      getWithTimeout(buildUrl(urlObj))
    },
    fail: function (id, msg) {
      var urlObj = buildUrlObj(cronitorUrl, 'fail', id, authKey)
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

// timeout keeps the req from hanging
// if cronitor is down, slow, etc
function getWithTimeout (url) {
  var req = https.get(url, noop)
  req.setTimeout((10 * 1000), noop)
}

function buildUrlObj (baseUrl, action, id, authKey) {
  var urlObj = {
    basePath: baseUrl + '/' + id + '/' + action
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
