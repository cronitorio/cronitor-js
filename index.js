var querystring = require('querystring')
var axios = require("axios")


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
}


/****
* Create new monitor
*
* @params { Object } obj monitor information
* @returns {Promise} Promise (err, body)
*
*/
Cronitor.prototype.create = function(obj) {
  validateMonitorApiKey.call(this)
	var params = requestParams.call(this, {data: obj})
  return axios
    .post(MONITOR_API_URL, params)
    .then((res) => {
      return res.data
    })
    .catch((err) => {
      return err.response
    })
}

/**
* Retrieve all monitors
* @params { Object } params filter params (pagination)
* @returns {Object} Array of monitors
*
*/
Cronitor.prototype.all = function(params) {
  validateMonitorApiKey.call(this)

  var params = requestParams.call(this, params)
  return axios
    .get(MONITOR_API_URL, params)
    .then((res) => {
      return res.data
    })
    .catch((err) => {
      return err.response
    })
}


/**
* Read single monitor
*
* @return {Object} monitor
*/

Cronitor.prototype.get = function() {
  validateMonitorCode.call(this)
  validateMonitorApiKey.call(this)

  var params = requestParams.call(this, {})
  return axios
    .get(`${MONITOR_API_URL}/${this.monitorCode}`, params)
    .then((res) => {
      return res.data
    })
    .catch((err) => {
      return err.response
    })

}


/**
* Update  monitor
*
* @params {Object} monitor info to update
* @return {Promise} Promise object
*/

Cronitor.prototype.update = function(obj) {
  validateMonitorCode.call(this)
  validateMonitorApiKey.call(this)

	var params = requestParams.call(this, {data: obj})
  return axios
    .put(`${MONITOR_API_URL}/${this.monitorCode}`, params)
    .then((res) => {
      return res.data
    })
    .catch((err) => {
      return err.response
    })
}


/**
* Delete  monitor
*
* @params { String} monitor code
* @return { Promise } Promise object
*/

Cronitor.prototype.delete = function() {
  validateMonitorCode.call(this)
  validateMonitorApiKey.call(this)
  var params = requestParams.call(this)
  return axios
    .delete(`${MONITOR_API_URL}/${this.monitorCode}`, params)
    .catch((err) => {
      return err.response
    })
}



/** PING API **/

/**
* Call run endpoint

* @params { String } message
* @return { Promise } Promise object
*/

Cronitor.prototype.run = function(message) {
  validateMonitorCode.call(this)
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'run', this.monitorCode, message, this.authKey))
  return axios.get(finalURL)
}


/**
* Call complete endpoint
*
* @params { String } message
* @return { Promise } Promise object
*/

Cronitor.prototype.complete = function(message) {
  validateMonitorCode.call(this)
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'complete', this.monitorCode, message, this.authKey))
  return axios.get(finalURL)
}


/**
* Call fail endpoint
*
* @params { String } message
* @return { Promise } Promise object
*/
Cronitor.prototype.fail = function(message) {
  validateMonitorCode.call(this)
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'fail', this.monitorCode, message, this.authKey))
	return axios.get(finalURL)
}

/**
* Pause  monitor
*
* @params { String} monitor code
* @return { Promise } Promise
*/

Cronitor.prototype.pause = function(time) {
  validateMonitorCode.call(this)
  var pauseURL = `${PING_API_URL}/${this.monitorCode}/pause/${time}${this.authKey ? `?auth_key=${this.authKey}` : '' }`
  return axios.get(pauseURL)
}

/**
* Unpause  monitor
*
* @params { String} monitor code
*/

Cronitor.prototype.unpause = function() {
  validateMonitorCode.call(this)
  var pauseURL = `${PING_API_URL}/${this.monitorCode}/pause/0${this.authKey ? `?auth_key=${this.authKey}` : '' }`
  return axios.get(pauseURL)
}

function validateMonitorCode() {
  if (!this.monitorCode)
    new Error("You must initialize cronitor with a monitor code to call this method.")
}

function validateMonitorApiKey() {
  if (!this.monitorApiKey)
    new Error("You must initialize cronitor with a monitorApiKey to call this method.")
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

function requestParams(params) {
  var params = params || {}
  var defaults = {
    headers: {
      'Authorization': 'Basic ' + new Buffer(this.monitorApiKey + ':').toString('base64')
    }
  }
  return {...defaults, params: params}
}


module.exports = Cronitor