const Errors = require('./errors');

const API_BASE_URL = 'https://cronitor.io';

function _extractList(body, keys) {
    if (Array.isArray(body)) {
        return body;
    }
    if (body && typeof body === 'object') {
        for (const key of keys) {
            if (Array.isArray(body[key])) {
                return body[key];
            }
        }
    }
    return [];
}

function _rethrowNotFound(err, NotFoundClass, message) {
    if (err && err.response && err.response.status === 404) {
        throw new NotFoundClass(message);
    }
    throw err;
}

class ErrorApp {
    static _apiUrl(key) {
        return key ? `${API_BASE_URL}/api/error-apps/${key}` : `${API_BASE_URL}/api/error-apps`;
    }

    static async create({ name, ...rest } = {}) {
        const payload = Object.assign({}, rest, { name });
        const resp = await this._api.axios.post(this._apiUrl(), payload);
        const app = new this(resp.data.key);
        app.data = resp.data;
        return app;
    }

    static async list({ page = 1, pageSize = 50, autoPaginate = false } = {}) {
        const apps = [];
        let currentPage = page;
        while (true) {
            const resp = await this._api.axios.get(this._apiUrl(), {
                params: { page: currentPage, pageSize },
            });
            const items = _extractList(resp.data, ['error_apps', 'apps', 'data']);
            for (const item of items) {
                const app = new this(item.key);
                app.data = item;
                apps.push(app);
            }
            if (!autoPaginate || items.length < pageSize) {
                break;
            }
            currentPage += 1;
        }
        return apps;
    }

    constructor(key) {
        this.key = key;
        this.data = null;
        this._api = this.constructor._api;
    }

    get dsn() {
        return this.data ? this.data.dsn : undefined;
    }

    async loadData() {
        try {
            const resp = await this._api.axios.get(this.constructor._apiUrl(this.key));
            this.data = resp.data;
            return this.data;
        } catch (err) {
            _rethrowNotFound(err, Errors.ErrorAppNotFound, `ErrorApp '${this.key}' not found`);
        }
    }

    async update({ name, ...rest } = {}) {
        const payload = Object.assign({}, rest);
        if (name !== undefined) {
            payload.name = name;
        }
        try {
            const resp = await this._api.axios.patch(this.constructor._apiUrl(this.key), payload);
            this.data = resp.data;
            return this;
        } catch (err) {
            _rethrowNotFound(err, Errors.ErrorAppNotFound, `ErrorApp '${this.key}' not found`);
        }
    }

    async delete() {
        try {
            await this._api.axios.delete(this.constructor._apiUrl(this.key));
            return true;
        } catch (err) {
            _rethrowNotFound(err, Errors.ErrorAppNotFound, `ErrorApp '${this.key}' not found`);
        }
    }

    async rotateKey() {
        try {
            const resp = await this._api.axios.post(`${this.constructor._apiUrl(this.key)}/rotate-key`);
            this.data = resp.data;
            return this;
        } catch (err) {
            _rethrowNotFound(err, Errors.ErrorAppNotFound, `ErrorApp '${this.key}' not found`);
        }
    }
}

class ErrorGroup {
    static _apiUrl(key) {
        return key ? `${API_BASE_URL}/api/errors/${key}` : `${API_BASE_URL}/api/errors`;
    }

    static async list({
        app,
        env,
        status,
        level,
        start,
        end,
        q,
        orderBy,
        page = 1,
        pageSize = 50,
        autoPaginate = false,
    } = {}) {
        const filters = {};
        const entries = [
            ['app', app],
            ['env', env],
            ['status', status],
            ['level', level],
            ['start', start],
            ['end', end],
            ['q', q],
            ['orderBy', orderBy],
        ];
        for (const [name, value] of entries) {
            if (value !== undefined && value !== null) {
                filters[name] = value;
            }
        }

        const groups = [];
        let currentPage = page;
        while (true) {
            const resp = await this._api.axios.get(this._apiUrl(), {
                params: Object.assign({}, filters, { page: currentPage, pageSize }),
            });
            const items = _extractList(resp.data, ['errors', 'data', 'groups']);
            for (const item of items) {
                const group = new this(item.key);
                group.data = item;
                groups.push(group);
            }
            if (!autoPaginate || items.length < pageSize) {
                break;
            }
            currentPage += 1;
        }
        return groups;
    }

    constructor(key) {
        this.key = key;
        this.data = null;
        this._api = this.constructor._api;
    }

    async loadData() {
        try {
            const resp = await this._api.axios.get(this.constructor._apiUrl(this.key));
            this.data = resp.data;
            return this.data;
        } catch (err) {
            _rethrowNotFound(err, Errors.ErrorGroupNotFound, `ErrorGroup '${this.key}' not found`);
        }
    }

    async update({ status, env } = {}) {
        const payload = { status };
        if (env !== undefined && env !== null) {
            payload.env = env;
        }
        try {
            const resp = await this._api.axios.patch(this.constructor._apiUrl(this.key), payload);
            this.data = resp.data;
            return this;
        } catch (err) {
            _rethrowNotFound(err, Errors.ErrorGroupNotFound, `ErrorGroup '${this.key}' not found`);
        }
    }

    async events({ env, app, cursor, limit = 50 } = {}) {
        const params = { limit };
        if (env !== undefined && env !== null) params.env = env;
        if (app !== undefined && app !== null) params.app = app;
        if (cursor !== undefined && cursor !== null) params.cursor = cursor;
        try {
            const resp = await this._api.axios.get(`${this.constructor._apiUrl(this.key)}/events`, { params });
            return resp.data;
        } catch (err) {
            _rethrowNotFound(err, Errors.ErrorGroupNotFound, `ErrorGroup '${this.key}' not found`);
        }
    }

    async event(eventId) {
        try {
            const resp = await this._api.axios.get(`${this.constructor._apiUrl(this.key)}/events/${eventId}`);
            return resp.data;
        } catch (err) {
            _rethrowNotFound(err, Errors.ErrorGroupNotFound, `Error event '${eventId}' not found`);
        }
    }
}

module.exports = {
    ErrorApp,
    ErrorGroup,
};
