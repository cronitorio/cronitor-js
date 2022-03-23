const qs = require('qs')
const Errors = require('./errors')

class Monitor {

    static get State() {
        return {
            RUN: 'run',
            COMPLETE: 'complete',
            FAIL: 'fail',
            OK: 'ok'
        }
    }

    static async put(data, rollback=false) {
        if (Array.isArray(data))
            data = data
        else if (typeof data == 'object')
            data = [data]
        else
            throw new Errors.MonitorNotCreated("Invalid monitor data.")

        try {
            const resp = await this._api.axios.put(this._api.monitorUrl(), {monitors: data, rollback})
            let monitors = resp.data.monitors.map((_m) => {
                let m = new Monitor(_m.key)
                m.data = _m
                return m
            })
            return monitors.length > 1 ? monitors : monitors[0]
        } catch(e) {
            throw new Errors.MonitorNotCreated(e.message)
        }
    }

    constructor(key) {
        if (!key) throw new Errors.InvalidMonitor("A key is required.")

        this.key = key
        this.data = null
        this._api = this.constructor._api
    }

    async data() {
        return this._api.axios
            .get(this._api.monitorUrl(this.key))
            .then((res) => {
                this.data = res.data
                return this.data
            })
            .catch(err => err.response)
    }

    async pause(hours) {
        try {
            let resp = await this._api.axios.get(`${this._api.monitorUrl(this.key)}/pause/${hours}`)
            return true
        } catch(e) {
            return false
            console.log(e)
        }
    }

    async unpause() {
        return this.pause(0)
    }

    async ok(params) {
        return this.ping({...params, state: Monitor.State.OK})
    }

    async delete() {
        try {
            await this._api.axios.delete(this._api.monitorUrl(this.key))
            return true
        } catch(e) {
            console.error(e)
            return false
        }


    }

    async ping(params={}) {
        try {
            await this._api.axios.get(
                this._api.pingUrl(this.key), {
                    params,
                    paramsSerializer: (params) => {
                        return qs.stringify(this._cleanParams(params), { arrayFormat: 'repeat', encode: false})
                      }
                })
            return true
        } catch(e) {
            console.error(e)
            return false
        }
    }

    _cleanParams(params={}) {

        let metric = null
        let host = params.host ||  process.env.HOSTNAME || null
        let series = params.series || null
        let message =  typeof params === 'string'
                ? params
                : params.message
                    ? params.message
                    : null

        if (!!params.metrics)
            metric = Object.keys(params.metrics).map(key => `${key}:${params.metrics[key]}`)

        if (host) host = encodeURIComponent(host)
        if (message) message = encodeURIComponent(message)
        if (series) series = encodeURIComponent(series)

        let allowedParams = {
            state: params.state || null,
            message: message,
            metric: metric,
            series: series,
            host: host,
            stamp: Date.now() / 1000,
            env: params.env || this._api.env
        }

        Object.keys(allowedParams).forEach((key) => (allowedParams[key] == null) && delete allowedParams[key])
        return allowedParams
    }
}


module.exports = Monitor
module.exports.default = Monitor