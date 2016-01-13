var https = require('https')
var querystring = require('querystring')
var cronitorUrl = 'https://cronitor.link'

module.exports = function (authKey) {
  return {
    run: function (id) {
      var urlObj = buildUrlObj('run', id, authKey)
      https.get(buildUrl(urlObj))
    },
    complete: function (id) {
      var urlObj = buildUrlObj('complete', id, authKey)
      https.get(buildUrl(urlObj))
    },
    fail: function (id, msg) {
      var urlObj = buildUrlObj('fail', id, authKey)
      if (msg) {
        if (!urlObj.qs) {
          urlObj.qs = {}
        }
        urlObj.qs.msg = msg
      }
      https.get(buildUrl(urlObj))
    },
    pause: function (id, hours) {
      if (!hours) {
        throw new Error('cronitor.pause requires an hours argument')
      }
      var urlObj = buildUrlObj('pause', id, authKey)
      urlObj.basePath += '/' + hours
      https.get(buildUrl(urlObj))
    }
  }
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
  return urlObj.basePath + (urlObj.qs ? '?' + querystring.stringify(urlObj.qs) : '')
}
