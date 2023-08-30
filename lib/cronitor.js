const querystring = require('querystring')
const axios = require("axios")
const yaml = require('js-yaml')
const fs = require('fs')
const Monitor = require('./monitor')
const Event = require('./event')
const Errors = require('./errors')
const { default: monitor } = require('./monitor')
const { ConfigError } = require('./errors')

const CONFIG_KEYS = ['api_key', 'api_version', 'environment']
const MONITOR_TYPES = ['job', 'heartbeat', 'check']
const YAML_KEYS = CONFIG_KEYS + MONITOR_TYPES.map(t => `${t}s`)


function Cronitor(apiKey, config={}) {
    if (!(this instanceof Cronitor)) return new Cronitor(apiKey, config)
    apiKey = apiKey || process.env.CRONITOR_API_KEY

    const path = config.config || process.env.CRONITOR_CONFIG
    if (path) this.config = this.readConfig({path})

    const version = config.apiVersion || process.env.CRONITOR_API_VERSION || null;

    const timeout = config.timeout || process.env.CRONITOR_TIMEOUT || 10000;

    const headers = {
        'User-Agent': 'cronitor-js',
        'Authorization': 'Basic ' + new Buffer(apiKey + ':').toString('base64')
    };
    if (version) headers['Cronitor-Version'] = version;

    this._api = {
        key: apiKey,
        version,
        env: config.environment || process.env.CRONITOR_ENVIRONMENT || null,
        pingUrl: (key) => `https://cronitor.link/ping/${apiKey}/${key}`,
        monitorUrl: (key) => `https://cronitor.io/api/monitors${key ? '/' + key : ''}`,
        axios: axios.create({
            baseURL: '',
            timeout,
            headers,
        })
    }

    this.Monitor = Monitor
    this.Event = Event

    this.Monitor._api = this._api
    this.Event._api = this._api

    this.generateConfig = async function() {
        throw new Error("generateConfig not implemented. Contact support@cronitor.io and we will help.")
    }

    this.applyConfig = async function(rollback=false) {
        if (!this.config.monitors)
            throw new Errors.ConfigError("Must call cronitor.readConfig('path/to/config') before calling applyConfig().")

        try {
            return await Monitor.put(this.config.monitors, rollback)
        } catch(e) {
            console.log(`Error applying config: ${e}`)
        }
    }

    this.validateConfig = async function() {
        return this.applyConfig(true)
    }

    this.readConfig = function(path=null, output=false) {
        if (!path)
            throw new Errors.ConfigError("Must include a path to config file e.g. cronitor.readConfig('./cronitor.yaml')")

        try {
            const doc = yaml.safeLoad(fs.readFileSync(path, 'utf8'))
            this.config = this._parseConfig(doc)
            if (this.config.apiKey) this._api.key = this.config.apiKey
            if (this.config.apiVersion) this._api.version = this.config.apiVersion
            if (this.config.environment) this._api.env = this.config.environment
            if (output) return this.config
        } catch(e) {
            console.log(e)
        }
    }

    this._parseConfig = function(data) {
        Object.keys(data).forEach((k) => {
            if (!YAML_KEYS.includes(k)) throw new Errors.ConfigError(`Invalid configuration variable ${k}`)
        })

        let monitors = []
        MONITOR_TYPES.forEach((t) => {
            let toParse = null
            let pluralT = `${t}s`

            if (data[t]) {
                toParse = data[t]
            } else if (data[pluralT]) {
                toParse = data[pluralT]
            }

            if (toParse) {
                if (typeof toParse != 'object') throw new Errors.ConfigError(`An object with keys corresponding to monitor keys is expected.`)

                Object.keys(toParse).forEach(k => {
                    toParse[k].key = k
                    toParse[k].type = t
                    monitors.push(toParse[k])
                })
            }
        })

        data.monitors = monitors
        return data
    }

    this.wrap = function(key, callback) {
        const _cronitor = this
        return async function(args) {
            let monitor = new _cronitor.Monitor(key)
            let series = _cronitor.newSeries()
            await monitor.ping({state: _cronitor.Monitor.State.RUN, series})
            try {
                let out = await Promise.resolve(callback(args))
                let message = typeof out == 'string' ? out.slice(-1600) : null
                await monitor.ping({state: _cronitor.Monitor.State.COMPLETE, message, series})
                return out
            } catch(e) {
                await monitor.ping({state: _cronitor.Monitor.State.FAIL, message: e, series})
            }
        }
    }

    this.wraps = function(lib) {
        // https://github.com/node-cron/node-cron
        if (!!lib.schedule) {
            this.schedule = function(key, schedule, cb, options) {
                const job = this.wrap(key, cb)
                return lib.schedule(schedule, job, options)
            }
        } else if (!!lib.job) { // https://github.com/kelektiv/node-cron
            this.job = function(key, schedule, cb) {
                const wrapped = this.wrap(key, cb)
                return lib.job(schedule, wrapped)
            }

            this.schedule = function(key, schedule, cb) {
                const job = this.job(key, schedule, cb)
                job.start()
            }
        } else {
            throw new Errors.ConfigError(`Unsupported library ${lib.name}`)
        }

    }

    this.newSeries = function() {
        return Math.abs((Math.random() * 0xFFFFFFFF << 0)).toString(16).padStart(8, '0')
    }
}



module.exports = Cronitor
// expose constructor as a named property to enable mocking with Sinon.JS
module.exports.Cronitor = Cronitor
module.exports.default = Cronitor
