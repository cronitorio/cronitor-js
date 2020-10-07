var querystring = require('querystring')
var axios = require("axios")


var MONITOR_API_URL = "https://cronitor.io/v3/monitors"
var PING_API_URL = "https://cronitor.link"

function Cronitor(options) {
  options = {...options}
  if (!options.monitorApiKey && !options.code)
    throw Error("You must supply a monitorCode or monitorApiKey to initialize cronitor.")

  this.monitorCode = options.code || null
  this.monitorApiKey = options.monitorApiKey || null
  this.authKey = options.authKey || null

  axios.defaults.headers.common['Authorization'] = 'Basic ' + new Buffer(this.monitorApiKey + ':').toString('base64')
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
  return axios
    .post(MONITOR_API_URL, obj)
    .then((res) => {
      this.monitorCode = res.data.code
      return res.data
    })
    .catch((err) => {
      return err.response
    })
}

/****
* Create a new cron job monitor
*
* @params { Object } config object.
*   required keys: expression, name
*   optional keys: notificationLists, graceSeconds
* @returns {Promise} Promise (err, body)
*
*/
Cronitor.prototype.createCron = function(config = {}) {
  if (!config.expression)
    throw new Error("'exression' is a required field e.g. {expression: '0 0 * * *', name: 'Daily at 00:00}")
  if (!config.name || !config.name.length)
    throw new Error("'name' is a required field e.g. {expression: '0 0 * * *', name: 'Daily at 00:00'}")
  if (config.notificationLists && !Array.isArray(config.notificationLists))
    throw new Error("'notificationLists' must be an array e.g. ['site-emergency']")

  var params = {
    type: "cron",
    name: config.name,
    rules: [
        {
          rule_type: "not_on_schedule",
          value: config.expression,
          grace_seconds: config.graceSeconds || null
        }
    ],
  }

  if (config.notificationLists)
    params['notifications'] = {templates: config.notificationLists}

  return this.create(params)
}

/****
* Create a new heartbeat monitor
*
* @params { Object } config object.
*   required keys: every, name
*   optional keys: notificationLists, graceSeconds
* @returns {Promise} Promise (err, body)
*
*/
Cronitor.prototype.createHeartbeat = function(config = {}) {
  var timeUnits = ['seconds', 'minutes', 'hours', 'days', 'weeks']

  if (!config.every && !config.at)
    throw new Error("missing required field 'every' or 'at'")

  if (config.every && !Array.isArray(config.every))
    throw new Error("'every' is a required field e.g. {every: [60, 'seconds']}")

  if (config.every && !Number.isInteger(config.every[0]))
    throw new Error("'every[0]' must be an integer")

  if (config.every && config.every[1].slice(-1) != 's')
    config.every[1] += 's'

  if (config.every && !timeUnits.includes(config.every[1]))
      throw new Error("'every[1]' is an invalid time unit. Must be one of: " + timeUnits.toString())

  if (config.at && !config.at.match(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/))
    throw new Error("invalid 'at' value. must use format 'HH:MM'")

  if (!config.name || !config.name.length)
    throw new Error("'name' is a required field e.g. {name: 'Daily at 00:00'}")

  if (config.notificationLists && !Array.isArray(config.notificationLists))
    throw new Error("'notificationLists' must be an array e.g. ['site-emergency']")


  var params = {
    type: "heartbeat_v2",
    name: config.name,
    rules: []
  }

  if (config.every)
    params.rules.push({
      rule_type: "run_ping_not_received",
      value: config.every[0],
      time_unit: config.every[1],
      grace_seconds: config.graceSeconds || null
    })

  if (config.at)
    params.rules.push({
      rule_type: "run_ping_not_received_at",
      value: config.at,
      grace_seconds: config.graceSeconds || null
    })


  if (config.notificationLists)
    params['notifications'] = {templates: config.notificationLists}

  return this.create(params)
}


/**
* Retrieve a set of monitors
* @params { Object } params filter params (pagination)
* @returns {Object} Array of monitors
*
*/
Cronitor.prototype.filter = function(params) {
  validateMonitorApiKey.call(this)
  return axios
    .get(MONITOR_API_URL, {params})
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
  return axios
    .get(`${MONITOR_API_URL}/${this.monitorCode}`)
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

  return axios
    .put(`${MONITOR_API_URL}/${this.monitorCode}`, obj)
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
  return axios
    .delete(`${MONITOR_API_URL}/${this.monitorCode}`)
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

Cronitor.prototype.run = function(message, timestamp) {
  validateMonitorCode.call(this)
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'run', this.monitorCode, message, this.authKey, timestamp))
  return axios.get(finalURL)
}


/**
* Call complete endpoint
*
* @params { String } message
* @return { Promise } Promise object
*/

Cronitor.prototype.complete = function(message, timestamp) {
  validateMonitorCode.call(this)
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'complete', this.monitorCode, message, this.authKey, timestamp))
  return axios.get(finalURL)
}


/**
* Call fail endpoint
*
* @params { String } message
* @return { Promise } Promise object
*/
Cronitor.prototype.fail = function(message, timestamp) {
  validateMonitorCode.call(this)
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'fail', this.monitorCode, message, this.authKey, timestamp))
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
* @params { String } monitor code
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

function buildUrlObj (baseUrl, action, code, msg, authKey, timestamp) {
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
    if (timestamp) {
      urlObj.qs.stamp = timestamp
    }
  }

  return urlObj
}

function buildUrl(urlObj) {
  var url = urlObj.basePath + (urlObj.qs ? '?' + querystring.stringify(urlObj.qs) : '')
  return url
}


module.exports = Cronitor