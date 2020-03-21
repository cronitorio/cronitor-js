var https = require('https')
var querystring = require('querystring')
var request = require("request")
var MONITOR_API_URL = "https://cronitor.io/v3/monitors"
var PING_API_URL = "https://cronitor.link"

function Cronitor(options) {
  var defaults = options || {}
  if (!defaults.monitorApiKey && !defaults.code) {
    throw Error("You must supply a monitorCode or monitorApiKey to initialize cronitor.")
  }
  this.monitorCode = defaults.code || null
  this.monitorApiKey = defaults.monitorApiKey
  this.authKey = defaults.authKey || null
  this.authHeader = new Buffer(this.monitorApiKey + ':').toString('base64')
}


/****
* Create new monitor
*
* @params { Object } obj monitor information
* @returns {Callback} callback (err, body)
*
*/
Cronitor.prototype.create = function(obj, callback) {
  if (!this.monitorApiKey) {
    throw Error("You must provide a monitorApiKey to create a monitor.")
  }

	var params = requestParams.call(this, {
		url: MONITOR_API_URL,
		body: obj,
	})

	request.post(params, function(err, res, body) {
    if (res.statusCode !== 201) {
      callback(body, null)
    } else {
      // TODO set this.monitorCode
      callback(err, body)
    }
  })
}

/**
* Fetch all monitors
*
* @returns {Object} Array of monitors
*
*/
Cronitor.prototype.all = function(filter, cb) {
	var qParams = {}
	var callback = null
	var args = Array.prototype.slice.call(arguments)

	if( args.length === 1)
		callback = args[0]
	else
		qParams = args[0]
		callback = args[1]

  if (!this.monitorApiKey) {
    throw Error("You must provide a monitorApiKey to list all your monitors.")
  }

  var params = requestParams.call(this, {
		url: MONITOR_API_URL,
		qs: qParams,
	})

	request.get(params, function(err, res, body) {
    if (res.statusCode !== 200)
      callback(body, null)
    else
      callback(err, body)
  })
}


/**
* Read single monitor
*
* @params { String} monitor code
* @return {Object} monitor
*/

Cronitor.prototype.get = function(monitorCode, cb) {
  var args = Array.prototype.slice.call(arguments)
  var callback = null
  var code = this.monitorCode
  if( args.length === 1) {
		callback = args[0]
  } else {
		code = args[0]
		callback = args[1]
  }

  if (!this.monitorApiKey)
    throw Error("You must provide a monitorApiKey to retrieve a monitor.")
  if (!code)
    throw Error("You must provide a monitor code to retrieve a monitor.")

  var params = requestParams.call(this, {url: MONITOR_API_URL + '/' + code})
	request.get(params, function(err, res, body) {
    if( res.statusCode !== 200) {
      callback(body, null)
    } else {
      callback(err, body)
    }
  })
}


/**
* Update  monitor
*
* @params { String} monitor code
* @params {Object} monitor info to update
* @return {Callback} Callback object with result or error
*/

Cronitor.prototype.update = function(monitorCode, obj, cb) {
  var code, body, callback
  var args = Array.prototype.slice.call(arguments)
  if( args.length === 3) {
    code = args[0]
    body = args[1]
		callback = args[2]
	} else {
    code = this.monitorCode
    body = args[0]
		callback = args[1]
  }

  if (!this.monitorApiKey)
    throw Error("You must provide a monitorApiKey to update a monitor.")
  if (!code)
    throw Error("You must provide a monitor code to update a monitor.")


	var params = requestParams.call(this, {
		url: MONITOR_API_URL + '/' + code,
		body: body,
	})

	request.put(params, function(err, res, body) {
    if(res.statusCode !== 200)
      callback(body, null)
    else
      callback(err, body)
  })
}

/**
* Delete  monitor
*
* @params { String} monitor code
* @return { Callback } Callback
*/

Cronitor.prototype.delete = function(monitorCode, cb) {
  var args = Array.prototype.slice.call(arguments)
  var callback = null
  var code = this.monitorCode
  if( args.length === 1) {
		callback = args[0]
  } else {
		code = args[0]
		callback = args[1]
  }

  if (!this.monitorApiKey)
    throw Error("You must provide a monitorApiKey to delete a monitor.")
  if (!code)
    throw Error("You must provide a monitor code to delete a monitor.")

  var params = requestParams.call(this, {url: MONITOR_API_URL + '/' + code})
	request.delete(params, function(err, res, body) {
    if( res.statusCode !== 204)
      callback(body, null)
    else
      if (code == this.monitorCode)
        this.monitorCode = null
      callback(err, body)
  })
}



/** PING API **/


/**
* Call run endpoint
*
* @params { String} monitor code
* @params { String } message
*/

Cronitor.prototype.run = function(message) {
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'run', this.monitorCode, message, this.authKey))
  request.get(finalURL)
}


/**
* Call complete endpoint
*
* @params { String} monitor code
* @params { String } message
*/

Cronitor.prototype.complete = function(message) {
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'complete', this.monitorCode, message, this.authKey))
  request.get(finalURL)
}


/**
* Call fail endpoint
*
* @params { String} monitor code
* @params { String } message
*/
Cronitor.prototype.fail = function(message) {
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'fail', this.monitorCode, message, this.authKey))
	request.get(finalURL)
}

/**
* Pause  monitor
*
* @params { String} monitor code
* @return { Callback } Callback
*/

Cronitor.prototype.pause = function(time) {
  if (!this.monitorCode) new Error("No monitor ")
  var pauseURL = PING_API_URL + '/' + this.monitorCode + '/pause/' + time
  if (this.authKey) pauseURL += '?auth_key=' + this.authKey
	request.get(pauseURL)
}

/**
* Unpause  monitor
*
* @params { String} monitor code
*/

Cronitor.prototype.unpause = function() {
  var pauseURL = PING_API_URL + '/' + this.monitorCode + '/pause/0'
  if (this.authKey) pauseURL += '?auth_key=' + this.authKey
  request.get(pauseURL)
}

function buildUrlObj (baseUrl, action, code, msg, authKey) {
  var urlObj = {
    basePath: baseUrl + '/' + code + '/' + action,
  }

  if (authKey || msg) {
    urlObj.qs = {}
    if (authKey) {
      urlObj.qs.auth_key = authKey
    }
    if (msg) {
      urlObj.qs.msg = msg
    }
  }

  return urlObj
}

function buildUrl (urlObj) {
  var url = urlObj.basePath + (urlObj.qs ? '?' + querystring.stringify(urlObj.qs) : '')
  return url
}

var requestParams = function(params) {
  var params = params || {}
  var defaults = {
    port: 443,
    headers: {
      'Authorization': 'Basic ' + this.authHeader
    },
    json: true
  }
  for (var attr in defaults) params[attr] = defaults[attr]

  return params
}



module.exports = Cronitor
