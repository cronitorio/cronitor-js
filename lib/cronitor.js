const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs').promises;

const Monitor = require('./monitor');
const Event = require('./event');
const Errors = require('./errors');
const ingest = require('./ingest');
const capture = require('./capture');
const { ErrorApp, ErrorGroup } = require('./error-tracking');

const MONITOR_TYPES = ['job', 'heartbeat', 'check', 'error'];
const YAML_KEYS = MONITOR_TYPES.map(t => `${t}s`);

function Cronitor(apiKey, config = {}) {
    if (!(this instanceof Cronitor)) return new Cronitor(apiKey, config);
    apiKey = apiKey || process.env.CRONITOR_API_KEY;

    const path = config.config || process.env.CRONITOR_CONFIG;
    const version = config.apiVersion || process.env.CRONITOR_API_VERSION || null;
    const timeout = config.timeout || process.env.CRONITOR_TIMEOUT || 10000;
    const env = config.environment || config.env || process.env.CRONITOR_ENVIRONMENT || process.env.CRONITOR_ENV || null;
    const region = config.region || process.env.CRONITOR_REGION || null;
    const dsn = config.dsn !== undefined ? config.dsn : (process.env.CRONITOR_DSN || null);
    const release = config.release !== undefined ? config.release : (process.env.CRONITOR_RELEASE || null);
    const captureExceptions = config.captureExceptions !== undefined ? Boolean(config.captureExceptions) : true;

    const headers = {
        'User-Agent': 'cronitor-js',
        'Authorization': 'Basic ' + new Buffer.from(apiKey + ':').toString('base64'),
    };

    if (path) this.path = path;
    if (version) headers['Cronitor-Version'] = version;

    let subdomain = '';
    if (region === 'eu') subdomain = 'eu.';

    this._release = release;
    this._captureExceptions = captureExceptions;
    this._transport = new ingest.Transport({ dsn });

    this.captureException = (error, options = {}) => capture.captureException(this, error, options);
    this.captureMessage = (message, options = {}) => capture.captureMessage(this, message, options);
    this.flush = (timeoutMs = 2000) => this._transport.flush(timeoutMs);

    this._api = {
        key: apiKey,
        version,
        env: env,
        pingUrl: (key) => `https://${subdomain}cronitor.link/ping/${apiKey}/${key}`,
        monitorUrl: (key) => `https://cronitor.io/api/monitors${key ? '/' + key : ''}`,
        captureException: this.captureException,
        captureMessage: this.captureMessage,
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

    class BoundErrorApp extends ErrorApp {}
    BoundErrorApp._api = this._api;
    this.ErrorApp = BoundErrorApp;

    class BoundErrorGroup extends ErrorGroup {}
    BoundErrorGroup._api = this._api;
    this.ErrorGroup = BoundErrorGroup;

    this.generateConfig = async ({ path = this.path, group = null } = {}) => {
        let url = 'https://cronitor.io/api/monitors.yaml';

        if (!path) {
            throw new Errors.ConfigError('Must initialize Cronitor with a "config" keyword arg as a valid file path or pass `path` as a keyword arg to generateConfig.');
        }

        if (group) url += `?group=${group}`;

        try {
            // Make HTTP GET request to fetch the YAML file
            const response = await this._api.axios.get(url, { responseType: 'blob' });
            await fs.writeFile(path, response.data, 'utf8');
            return true;
        } catch (error) {
            console.error('Failed to download or save the YAML file:', error);
            return false;
        }
    };


    this.applyConfig = async function ({ path = this.path, rollback = false } = {}) {
        if (!path) throw new Errors.ConfigError('Must include a path to config file e.g. cronitor.applyConfig({path: \'./cronitor.yaml\'})');

        try {
            config = await this.readConfig({ path, output: true });
        } catch (err) {
            console.error('Error reading config:', err);
            return false;
        }

        try {
            await Monitor.put(config, { rollback, format: Monitor.requestType.YAML });
            console.log(`Cronitor config ${rollback ? 'validated' : 'applied'} successfully.`);
            return true;
        } catch (err) {
            console.error(`Error applying config: ${err}`);
            return false;
        }
    };

    this.validateConfig = async ({ path = this.path } = {}) => {
        return this.applyConfig({ path, rollback: true });
    };

    this.readConfig = async function ({ path = null, output = false } = {}) {
        if (!path) throw new Errors.ConfigError('Must include a path to config file e.g. cronitor.readConfig({path: \'./cronitor.yaml\'})');
        if (!this.path) this.path = path;

        try {
            const configFile = await fs.readFile(path, 'utf8');
            this.config = yaml.load(configFile);
            if (output) return this.config;
            return true;
        } catch (err) {
            console.error('Error reading Cronitor config file:', err);
            return false;
        }
    };


    this.wrap = function (key, callback, options = {}) {
        const _cronitor = this;
        const shouldCapture = options && options.captureExceptions !== undefined
            ? Boolean(options.captureExceptions)
            : _cronitor._captureExceptions;

        return async function (...args) {
            const monitor = new _cronitor.Monitor(key);
            const series = _cronitor.newSeries();
            try {
                await monitor.ping({ state: _cronitor.Monitor.State.RUN, series });
            } catch (_) {
                // ignore ping failures
            }
            try {
                const out = await Promise.resolve(callback(...args));
                const message = typeof out == 'string' ? out.slice(-1600) : null;
                try {
                    await monitor.ping({ state: _cronitor.Monitor.State.COMPLETE, message, series });
                } catch (_) {
                    // ignore ping failures
                }
                return out;
            } catch (err) {
                try {
                    await monitor.ping({ state: _cronitor.Monitor.State.FAIL, message: err, series });
                } catch (_) {
                    // ignore ping failures
                }
                if (shouldCapture && ingest.parseDsn(_cronitor._transport && _cronitor._transport._dsn)) {
                    capture.captureException(_cronitor, err, {
                        monitor: key,
                        series,
                        mechanism: 'cronitor.wrap',
                        handled: false,
                    });
                }
                throw err;
            }
        };
    };

    this.wraps = function (lib) {
        // https://github.com/node-cron/node-cron
        if (lib.schedule) {
            this.schedule = function (key, schedule, cb, options) {
                const job = this.wrap(key, cb);
                return lib.schedule(schedule, job, options);
            };
        } else if (lib.job) { // https://github.com/kelektiv/node-cron
            this.job = function (key, schedule, cb) {
                const wrapped = this.wrap(key, cb);
                return lib.job(schedule, wrapped);
            };

            this.schedule = function (key, schedule, cb) {
                const job = this.job(key, schedule, cb);
                job.start();
            };
        } else {
            console.log(lib.CronJob);
            throw new Errors.ConfigError(`Unsupported library ${lib.name}`);
        }

    };

    this.newSeries = () => {
        return Math.abs((Math.random() * 0xFFFFFFFF << 0)).toString(16).padStart(8, '0');
    };
}

Cronitor.MonitorNotCreated = Errors.MonitorNotCreated;
Cronitor.ConfigError = Errors.ConfigError;
Cronitor.InvalidMonitor = Errors.InvalidMonitor;
Cronitor.ErrorAppNotFound = Errors.ErrorAppNotFound;
Cronitor.ErrorGroupNotFound = Errors.ErrorGroupNotFound;

module.exports = Cronitor;
// expose constructor as a named property to enable mocking with Sinon.JS
module.exports.Cronitor = Cronitor;
module.exports.default = Cronitor;
