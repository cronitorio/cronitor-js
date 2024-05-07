const qs = require('qs');
const Errors = require('./errors');
const yaml = require('js-yaml');

class Monitor {
    static get State() {
        return {
            RUN: 'run',
            COMPLETE: 'complete',
            FAIL: 'fail',
            OK: 'ok',
        };
    }

    static get requestType() {
        return {
            JSON: 'json',
            YAML: 'yaml',
        };
    }

    static async put(data, {rollback = false, format = Monitor.requestType.JSON} = {}) {

        if (format === Monitor.requestType.YAML) {
            return this.putYaml(yaml.dump({...data, rollback}))

        }

        // if a user passed a single monitor object, wrap it in an array
        if (!Array.isArray(data)) {
            data = [data];
        }

        try {
            const resp = await this._api.axios.put(this._api.monitorUrl(), {monitors: data, rollback});
            const monitors = resp.data.monitors.map((_m) => {
                const m = new Monitor(_m.key);
                m.data = _m;
                return m;
            });
            return monitors.length > 1 ? monitors : monitors[0];
        } catch (err) {
            throw new Errors.MonitorNotCreated(err.message);
        }
    }

    static async putYaml(payload) {
        try {
            const resp = await this._api.axios.put(
                this._api.monitorUrl(),
                payload,
                { headers: {'Content-Type': 'application/yaml'} }
            );
            return yaml.load(resp.data);
        } catch (err) {
            throw new Errors.MonitorNotCreated(err.message);
        }

    }

    constructor(key) {
        if (!key) throw new Errors.InvalidMonitor('A key is required.');

        this.key = key;
        this.data = null;
        this._api = this.constructor._api;
    }

    async data() {
        return this._api.axios
            .get(this._api.monitorUrl(this.key))
            .then((res) => {
                this.data = res.data;
                return this.data;
            })
            .catch(err => err.response);
    }

    async pause(hours) {
        try {
            await this._api.axios.get(`${this._api.monitorUrl(this.key)}/pause/${hours}`);
            return true;
        } catch (err) {
            console.log(err);
            return false;
        }
    }

    async unpause() {
        return this.pause(0);
    }

    async ok(params) {
        return this.ping({ ...params, state: Monitor.State.OK });
    }

    async delete() {
        try {
            await this._api.axios.delete(this._api.monitorUrl(this.key));
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    }

    async ping(params = {}) {
        try {
            await this._api.axios.get(
                this._api.pingUrl(this.key), {
                    params,
                    paramsSerializer: (paramsSerializer) => {
                        return qs.stringify(this._cleanParams(paramsSerializer), { arrayFormat: 'repeat', encode: false });
                    },
                });
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    }

    _cleanParams(params = {}) {

        let metric = null;
        let host = params.host || process.env.HOSTNAME || null;
        let series = params.series || null;
        let message = typeof params === 'string'
            ? params
            : params.message
                ? params.message
                : null;

        if (params.metrics) metric = Object.keys(params.metrics).map(key => `${key}:${params.metrics[key]}`);
        if (host) host = encodeURIComponent(host);
        if (message) message = encodeURIComponent(message);
        if (series) series = encodeURIComponent(series);

        const allowedParams = {
            state: params.state || null,
            message: message,
            metric: metric,
            series: series,
            host: host,
            stamp: Date.now() / 1000,
            env: params.env || this._api.env,
        };

        Object.keys(allowedParams).forEach((key) => (allowedParams[key] == null) && delete allowedParams[key]);
        return allowedParams;
    }
}

module.exports = Monitor;
module.exports.default = Monitor;
