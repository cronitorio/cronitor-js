var https = require('https')
var querystring = require('querystring')
var request = require("request")
var MONITOR_API_URL = "https://cronitor.io/v3"
var PING_API_URL = "https://cronitor.link"

/* istanbul ignore next: not testing https module */
var noop = function () {}

// module.exports = function (authKey) {
//   return {
//     run: function (id) {
//       var urlObj = buildUrlObj(cronitorUrl, 'run', id, authKey)
//       getWithTimeout(buildUrl(urlObj))
//     },
//     complete: function (id) {
//       var urlObj = buildUrlObj(cronitorUrl, 'complete', id, authKey)
//       getWithTimeout(buildUrl(urlObj))
//     },
//     pause: function (id, hours) {
//       var urlObj = buildUrlObj(cronitorPauseUrl, 'pause', id, authKey)
//       urlObj.basePath = urlObj.basePath + '/' + hours
//       getWithTimeout(buildUrl(urlObj))
//     },
//     fail: function (id, msg) {
//       var urlObj = buildUrlObj(cronitorUrl, 'fail', id, authKey)
//       if (msg) {
//         if (!urlObj.qs) {
//           urlObj.qs = {}
//         }
//         urlObj.qs.msg = msg
//       }
//       getWithTimeout(buildUrl(urlObj))
//     }
//   }
// }


function CronitorClient(options) {
  var defaults = options || {}
  if (!defaults.monitorApiKey && !defaults.code) {
    throw Error("You must supply a monitorCode or monitorApiKey to initialize cronitor.")
  }
  this.monitorCode = defaults.code || null
  this.monitorApiKey = defaults.monitorApiKey
  this.authKey = defaults.authKey || null
  this.authHeader = new Buffer(this.monitorApiKey + ':').toString('base64')
}

// /*****
// * Create new monitor on cronitor.io
// *
// * @params {Object}  cron objects
// * @params {Callback} Callback (error, body)
// *
// */

// CronitorClient.prototype.test = function(callback) {

// 	var options = {
// 		url: MONITOR_API_URL,
// 		port: 443,
// 		headers: {
// 			'Authorization': 'Basic ' + this.authHeader
// 		}
// 	}

// 	request(options, function(err, res, body) {
// 				if (err) {
// 					callback(err, null)
// 				} else {
// 					if( res.statusCode === 403){
// 						debug("Access key invalid or absent")
// 						err = body
// 						body = null
// 					}
// 				}
// 				callback(err,body)

// 		})

// }

/****
* Create new monitor
*
* @params { Object } obj monitor information
* @returns {Callback} callback (err, body)
*
*/
CronitorClient.prototype.create = function(obj, callback) {
  if (!this.monitorApiKey) {
    // TODO setter for apiKey
    throw Error("You must set a monitorApiKey to create a new monitor.")
  }
	var options = {
		method: 'POST',
		url: MONITOR_API_URL,
		port: 443,
		headers: {
			'Authorization': 'Basic ' + this.authHeader
			},
		body: obj,
		json: true
	}

	request(options, function(err, res, body) {
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
CronitorClient.prototype.all = function(filter, cb) {
  if (!this.monitorApiKey) {
    // TODO setter for apiKey
    throw Error("You must provide a monitorApiKey to list all your monitors.")
  }
	var params = {}
	var callback = null
	var args = Array.prototype.slice.call(arguments)

	if( args.length === 1) {
		callback = args[0]
	} else {
		params = args[0]
		callback = args[1]
	}

	var options = {
		method: 'GET',
		url: MONITOR_API_URL,
		port: 443,
		headers: {
			'Authorization': 'Basic ' + this.authHeader
			},
		json: true,
		qs: params
	}

	request(options, function(err, res, body){
    if (res.statusCode !== 200){
      callback(body, null)
    } else {
      callback(err, body)
    }
  })
}


/**
* Read single monitor
*
* @params { String} monitor code
* @return {Object} monitor
*/

CronitorClient.prototype.get = function(monitorCode, cb) {
  var args = Array.prototype.slice.call(arguments)
  var callback = null
  var code = this.monitorCode

  if (!this.monitorApiKey) {
    // TODO setter for apiKey
    throw Error("You must provide a monitorApiKey to retrieve a monitor.")
  }

	if( args.length === 1) {
		callback = args[0]
	} else {
		code = args[0]
		callback = args[1]
  }

	var options = {
		method: 'GET',
		url: MONITOR_API_URL + '/' + code,
		port: 443,
		headers: {
			'Authorization': 'Basic ' + this.authHeader
			},
		json: true
	}

	request(options, function(err, res, body) {
    if( res.statusCode !== 200){
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

CronitorClient.prototype.update = function(monitorCode, obj, cb) {
  var code, body, callback
  var args = Array.prototype.slice.call(arguments)

  if (!this.monitorApiKey) {
    // TODO setter for apiKey
    throw Error("You must provide a monitorApiKey to update a monitor.")
  }

	if( args.length === 3) {
    code = args[0]
    body = args[1]
		callback = args[2]
	} else {
    code = this.monitorCode
    body = args[0]
		callback = args[1]
  }

	var options = {
		method: 'PUT',
		url: MONITOR_API_URL + '/' + code,
		port: 443,
		headers: {
			'Authorization': 'Basic ' + this.authHeader
			},
		body: body,
		json: true
	}

	request(options, function(err, res, body) {
    if(res.statusCode !== 200) {
      callback(body, null)
    } else {
      callback(err, body)
    }
  })
}

/**
* Delete  monitor
*
* @params { String} monitor code
* @return { Callback } Callback
*/

CronitorClient.prototype.delete = function(monitorCode, cb) {
  var args = Array.prototype.slice.call(arguments)
  var callback = null
  var code = this.monitorCode

  if (!this.monitorApiKey) {
    // TODO setter for apiKey
    throw Error("You must provide a monitorApiKey to delete a monitor.")
  }

	if( args.length === 1) {
		callback = args[0]
	} else {
		code = args[0]
		callback = args[1]
  }

	var options = {
		method: 'DELETE',
		url: MONITOR_API_URL + '/' + this.monitorCode,
		port: 443,
		headers: {
			'Authorization': 'Basic ' + this.authHeader
		},
		json: true
	}

	request(options, function(err, res, body) {
    if( res.statusCode !== 204) {
      callback(body, null)
    } else {
      this.monitorCode = null
      callback(err, body)
    }
  })
}


/** PING API **/


/**
* Call run endpoint
*
* @params { String} monitor code
* @params { String } message
*/

CronitorClient.prototype.run = function(message) {
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'run', this.monitorCode, message, this.authKey))
  request.get(finalURL)
}


/**
* Call complete endpoint
*
* @params { String} monitor code
* @params { String } message
*/

CronitorClient.prototype.complete = function(message) {
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'complete', this.monitorCode, message, this.authKey))
  request.get(finalURL)
}


/**
* Call fail endpoint
*
* @params { String} monitor code
* @params { String } message
*/
CronitorClient.prototype.fail = function(message) {
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'fail', this.monitorCode, message, this.authKey))
	request.get(finalURL)
}

/**
* Pause  monitor
*
* @params { String} monitor code
* @return { Callback } Callback
*/

CronitorClient.prototype.pause = function(time) {
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

CronitorClient.prototype.unpause = function() {
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


module.exports = CronitorClient
