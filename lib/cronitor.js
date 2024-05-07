const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs').promises;
const path = require('path');

const Monitor = require('./monitor');
const Event = require('./event');
const Errors = require('./errors');

const MONITOR_TYPES = ['job', 'heartbeat', 'check'];
const YAML_KEYS = MONITOR_TYPES.map(t => `${t}s`);

function Cronitor(apiKey, config = {}) {
    if (!(this instanceof Cronitor)) return new Cronitor(apiKey, config);
    apiKey = apiKey || process.env.CRONITOR_API_KEY;

    const path = config.config || process.env.CRONITOR_CONFIG;
    const version = config.apiVersion || process.env.CRONITOR_API_VERSION || null;
    const timeout = config.timeout || process.env.CRONITOR_TIMEOUT || 10000;
    const env = config.env || process.env.CRONITOR_ENV || null;
    const headers = {
        'User-Agent': 'cronitor-js',
        'Authorization': 'Basic ' + new Buffer.from(apiKey + ':').toString('base64'),
    };

    if (path) this.path = path;
    if (version) headers['Cronitor-Version'] = version;

    this._api = {
        key: apiKey,
        version,
        env: env,
        pingUrl: (key) => `https://cronitor.link/ping/${apiKey}/${key}`,
        monitorUrl: (key) => `https://cronitor.io/api/monitors${key ? '/' + key : ''}`,
        axios: axios.create({
            baseURL: '',
            timeout,
            headers,
        }),
    };

    this.Monitor = Monitor;
    this.Event = Event;

    this.Monitor._api = this._api;
    this.Event._api = this._api;

    this.generateConfig = async ({path=this.path, group=null}={}) => {
        let url = 'https://cronitor.io/api/monitors.yaml';

        if (!path) {
            throw new Errors.ConfigError('Must initialize Cronitor with a "config" keyword arg as a valid file path or pass `path` as a keyword arg to generateConfig.');
        }

        if (group) url += `?group=${group}`;

        try {
            // Make HTTP GET request to fetch the YAML file
            const response = await this._api.axios.get(url, { responseType: 'blob' });
            await fs.writeFile(path, response.data, 'utf8');
            return true
        } catch (error) {
            console.error('Failed to download or save the YAML file:', error);
            return false
        }
    };


    this.applyConfig = async function({ path = this.path, rollback = false } = {}) {
        if (!path) throw new Errors.ConfigError('Must include a path to config file e.g. cronitor.applyConfig({path: \'./cronitor.yaml\'})');

        try {
            config = await this.readConfig({ path, output: true});
        } catch (err) {
            console.error('Error reading config:', err);
            return false
        }

        try {
            await Monitor.put(config, {rollback, format: Monitor.requestType.YAML});
            console.log(`Cronitor config ${rollback ? 'validated' : 'applied'} successfully.`)
            return true
        } catch (err) {
            console.error(`Error applying config: ${err}`);
            return false
        }
    };

    this.validateConfig = async ({ path = this.path} = {}) => {
        return this.applyConfig({ path, rollback: true });
    };

    this.readConfig = async function({path = null, output = false}={}) {
        if (!path) throw new Errors.ConfigError('Must include a path to config file e.g. cronitor.readConfig({path: \'./cronitor.yaml\'})');
        if (!this.path) this.path = path;

        try {
            let configFile = await fs.readFile(path, 'utf8')
            this.config = yaml.load(configFile);
            if (output) return this.config;
            return true
        } catch (err) {
            console.error('Error reading Cronitor config file:', err);
            return false
        }
    };


    this.wrap = function(key, callback) {
        const _cronitor = this;
        return async function(args) {
            const monitor = new _cronitor.Monitor(key);
            const series = _cronitor.newSeries();
            await monitor.ping({ state: _cronitor.Monitor.State.RUN, series });
            try {
                const out = await Promise.resolve(callback(args));
                const message = typeof out == 'string' ? out.slice(-1600) : null;
                await monitor.ping({ state: _cronitor.Monitor.State.COMPLETE, message, series });
                return out;
            } catch (err) {
                await monitor.ping({ state: _cronitor.Monitor.State.FAIL, message: err, series });
            }
        };
    };

    this.wraps = function(lib) {
        // https://github.com/node-cron/node-cron
        if (lib.schedule) {
            this.schedule = function(key, schedule, cb, options) {
                const job = this.wrap(key, cb);
                return lib.schedule(schedule, job, options);
            };
        } else if (lib.job) { // https://github.com/kelektiv/node-cron
            this.job = function(key, schedule, cb) {
                const wrapped = this.wrap(key, cb);
                return lib.job(schedule, wrapped);
            };

            this.schedule = function(key, schedule, cb) {
                const job = this.job(key, schedule, cb);
                job.start();
            };
        } else {
            console.log(lib.CronJob)
            throw new Errors.ConfigError(`Unsupported library ${lib.name}`);
        }

    };

    this.newSeries = () => {
        return Math.abs((Math.random() * 0xFFFFFFFF << 0)).toString(16).padStart(8, '0');
    };
}

module.exports = Cronitor;
// expose constructor as a named property to enable mocking with Sinon.JS
module.exports.Cronitor = Cronitor;
module.exports.default = Cronitor;
