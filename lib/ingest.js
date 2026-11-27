const axios = require('axios');
const zlib = require('zlib');
const pkg = require('../package.json');

const SDK_NAME = 'cronitor-js';
const SDK_VERSION = pkg.version;

const MAX_IN_FLIGHT = 1000;
const SEND_TIMEOUT_MS = 5000;
const MAX_RETRY_AFTER_MS = 60 * 1000;
const MAX_EVENT_BYTES = 900 * 1024;
const TRIMMED_FRAMES = 20;
const EVENT_CONTENT_TYPE = 'application/json';

function parseDsn(dsn) {
    if (!dsn || typeof dsn !== 'string') {
        return null;
    }
    const raw = dsn.trim();
    if (!raw) {
        return null;
    }
    let parsed;
    try {
        parsed = new URL(raw);
    } catch (_) {
        return null;
    }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname || !parsed.username) {
        return null;
    }
    const scheme = parsed.protocol.slice(0, -1);
    const netloc = parsed.host;
    const trimmedPath = parsed.pathname.replace(/^\/+|\/+$/g, '');
    let prefix = '';
    let projectId = '1';
    if (trimmedPath) {
        const lastSlash = trimmedPath.lastIndexOf('/');
        if (lastSlash !== -1) {
            prefix = '/' + trimmedPath.slice(0, lastSlash);
            projectId = trimmedPath.slice(lastSlash + 1);
        } else {
            projectId = trimmedPath;
        }
    }
    const ingestKey = parsed.username;
    const url = `${scheme}://${netloc}${prefix}/api/${projectId}/envelope/`;
    const publicDsn = `${scheme}://${ingestKey}@${netloc}${prefix}/${projectId}`;
    return { ingestKey, url, publicDsn };
}

function sdkInfo() {
    return { name: SDK_NAME, version: SDK_VERSION };
}

function authHeader(ingestKey) {
    return `Sentry sentry_key=${ingestKey}, sentry_version=7, sentry_client=${SDK_NAME}/${SDK_VERSION}`;
}

function requestHeaders(ingestKey) {
    return {
        'Content-Type': 'application/x-sentry-envelope',
        'Content-Encoding': 'gzip',
        'User-Agent': SDK_NAME,
        'X-Sentry-Auth': authHeader(ingestKey),
    };
}

function formatTimestamp(value) {
    const date = value instanceof Date ? value : new Date();
    return date.toISOString();
}

function _safeString(value) {
    try {
        return String(value);
    } catch (_) {
        return '<unrepresentable>';
    }
}

function _jsonSafe(value, depth, seen) {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : String(value);
    }
    if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
        return _safeString(value);
    }
    if (typeof value !== 'object') {
        return value;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    }
    if (seen.has(value)) {
        return '[Circular]';
    }
    if (depth >= 10) {
        return _safeString(value);
    }
    seen.add(value);
    try {
        if (Array.isArray(value)) {
            return value.map((item) => _jsonSafe(item, depth + 1, seen));
        }
        const out = {};
        for (const key of Object.keys(value)) {
            const prop = value[key];
            if (prop !== undefined && typeof prop !== 'function' && typeof prop !== 'symbol') {
                out[key] = _jsonSafe(prop, depth + 1, seen);
            }
        }
        return out;
    } finally {
        seen.delete(value);
    }
}

function jsonBytes(obj) {
    const safe = _jsonSafe(obj, 0, new Set());
    return Buffer.from(JSON.stringify(safe), 'utf8');
}

function serializeEnvelope(headers, items) {
    const newline = Buffer.from('\n', 'utf8');
    const parts = [jsonBytes(headers), newline];
    for (const [itemHeaders, payload] of items) {
        const withLength = Object.assign({}, itemHeaders, { length: payload.length });
        parts.push(jsonBytes(withLength), newline, payload, newline);
    }
    return Buffer.concat(parts);
}

function _ownFrames(event) {
    const exception = event.exception || {};
    const rawValues = exception.values || [];
    const values = [];
    const frameLists = [];
    for (const value of rawValues) {
        const stacktrace = value.stacktrace || {};
        if (Array.isArray(stacktrace.frames) && stacktrace.frames.length > 0) {
            const frames = stacktrace.frames.map((frame) => Object.assign({}, frame));
            const clonedValue = Object.assign({}, value, {
                stacktrace: Object.assign({}, stacktrace, { frames }),
            });
            frameLists.push(frames);
            values.push(clonedValue);
        } else {
            values.push(value);
        }
    }
    if (values.length > 0) {
        event.exception = Object.assign({}, exception, { values });
    }
    return frameLists;
}

function _dropSourceContext(event) {
    let dropped = false;
    for (const frames of _ownFrames(event)) {
        for (const frame of frames) {
            if ('pre_context' in frame) {
                delete frame.pre_context;
                dropped = true;
            }
            if ('post_context' in frame) {
                delete frame.post_context;
                dropped = true;
            }
        }
    }
    return dropped;
}

function _dropExtra(event) {
    const extra = event.extra;
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
        return false;
    }
    const keys = Object.keys(extra);
    if (keys.length === 0 || keys.every((key) => key === '_trimmed')) {
        return false;
    }
    event.extra = {};
    return true;
}

function _keepLastFrames(event) {
    let cut = false;
    for (const frames of _ownFrames(event)) {
        if (frames.length > TRIMMED_FRAMES) {
            frames.splice(0, frames.length - TRIMMED_FRAMES);
            cut = true;
        }
    }
    return cut;
}

const EVENT_TRIMS = [
    ['source context dropped', _dropSourceContext],
    ['extra dropped', _dropExtra],
    [`frames cut to the last ${TRIMMED_FRAMES} per exception`, _keepLastFrames],
];

function eventBytes(event) {
    let payload = jsonBytes(event);
    if (payload.length <= MAX_EVENT_BYTES) {
        return payload;
    }
    try {
        const copy = Object.assign({}, event);
        const dropped = [];
        for (const [note, trim] of EVENT_TRIMS) {
            if (!trim(copy)) {
                continue;
            }
            dropped.push(note);
            const extra = (copy.extra && typeof copy.extra === 'object' && !Array.isArray(copy.extra))
                ? Object.assign({}, copy.extra)
                : {};
            extra._trimmed = `${dropped.join('; ')}: event over ${MAX_EVENT_BYTES / 1024} KB`;
            copy.extra = extra;
            payload = jsonBytes(copy);
            if (payload.length <= MAX_EVENT_BYTES) {
                break;
            }
        }
    } catch (err) {
        console.warn('Cronitor could not trim an oversized event:', err);
    }
    return payload;
}

function eventEnvelope(payload, eventId, sentAt, dsn) {
    const headers = {
        event_id: eventId,
        sent_at: formatTimestamp(sentAt),
        sdk: sdkInfo(),
    };
    if (dsn) {
        headers.dsn = dsn;
    }
    const item = { type: 'event', content_type: EVENT_CONTENT_TYPE };
    return serializeEnvelope(headers, [[item, payload]]);
}

function _parseSeconds(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const seconds = Number(value);
    return Number.isFinite(seconds) ? seconds : null;
}

function _retryAfterMs(response) {
    const headers = (response && response.headers) || {};
    let delaySec = null;
    const limits = headers['x-sentry-rate-limits'] || headers['X-Sentry-Rate-Limits'];
    if (typeof limits === 'string' && limits.length > 0) {
        delaySec = _parseSeconds(limits.split(',')[0].split(':')[0]);
    }
    if (delaySec === null) {
        const retryAfter = headers['retry-after'] || headers['Retry-After'];
        delaySec = _parseSeconds(retryAfter);
    }
    if (delaySec === null) {
        return MAX_RETRY_AFTER_MS;
    }
    return Math.max(0, Math.min(delaySec * 1000, MAX_RETRY_AFTER_MS));
}

class Transport {
    constructor({ dsn = null, send = null, maxInFlight = MAX_IN_FLIGHT } = {}) {
        this._dsn = dsn;
        this._send = send || this._httpSend.bind(this);
        this._maxInFlight = maxInFlight;
        this._http = axios.create({
            timeout: SEND_TIMEOUT_MS,
            validateStatus: () => true,
            transformRequest: [(data) => data],
        });
        this._inFlight = new Set();
        this._rateLimitedUntil = 0;
        this._reportedRateLimit = false;
        this._reportedMissingDsn = false;
        this._reportedInvalidDsn = false;
        this.dropped = 0;
    }

    _resolveDsn(dsn) {
        const raw = dsn !== undefined && dsn !== null ? dsn : this._dsn;
        if (!raw) {
            if (!this._reportedMissingDsn) {
                this._reportedMissingDsn = true;
                console.error('No DSN detected. Set dsn or CRONITOR_DSN to capture exceptions and messages.');
            }
            return null;
        }
        const parsed = parseDsn(raw);
        if (!parsed) {
            if (!this._reportedInvalidDsn) {
                this._reportedInvalidDsn = true;
                console.error('Invalid Cronitor DSN. Expected https://<ingest_key>@cronitor.link/1.');
            }
            return null;
        }
        return parsed;
    }

    submitEvent(event, dsn) {
        const resolved = this._resolveDsn(dsn);
        if (!resolved) {
            return false;
        }
        const remainingMs = this._rateLimitedUntil - Date.now();
        if (remainingMs > 0) {
            this.dropped += 1;
            if (!this._reportedRateLimit) {
                this._reportedRateLimit = true;
                console.warn(`Cronitor is rate limited for ${Math.ceil(remainingMs / 1000)} more seconds; dropping envelopes until then.`);
            }
            return false;
        }
        if (this._inFlight.size >= this._maxInFlight) {
            this.dropped += 1;
            if (this.dropped === 1 || this.dropped % 1000 === 0) {
                console.warn(`Cronitor ingest queue is full, ${this.dropped} item(s) dropped so far.`);
            }
            return false;
        }
        try {
            const payload = eventBytes(event);
            const envelope = eventEnvelope(payload, event.event_id, null, resolved.publicDsn);
            const pending = this._deliver(resolved.url, resolved.ingestKey, envelope)
                .catch((err) => {
                    console.warn('Cronitor could not send an envelope:', err);
                });
            this._inFlight.add(pending);
            pending.finally(() => {
                this._inFlight.delete(pending);
            });
            return true;
        } catch (err) {
            console.warn('Cronitor could not queue an event:', err);
            return false;
        }
    }

    async _deliver(url, ingestKey, body) {
        let compressed;
        try {
            compressed = zlib.gzipSync(body, { level: 6 });
        } catch (err) {
            console.warn('Cronitor could not compress an envelope:', err);
            return;
        }
        let response;
        try {
            response = await this._send(url, compressed, requestHeaders(ingestKey), SEND_TIMEOUT_MS);
        } catch (err) {
            console.warn(`Cronitor could not send an envelope to ${url}:`, err);
            return;
        }
        const status = response && typeof response.status === 'number' ? response.status : null;
        if (status === null) {
            return;
        }
        if (status === 429) {
            const delayMs = _retryAfterMs(response);
            this._rateLimitedUntil = Date.now() + delayMs;
            this._reportedRateLimit = false;
            console.warn(`Cronitor rate limited the envelope (HTTP 429); not sending for ${Math.round(delayMs / 1000)} seconds.`);
        } else if (status >= 400) {
            console.warn(`Cronitor rejected an envelope with HTTP ${status}.`);
        }
    }

    _httpSend(url, data, headers, timeout) {
        return this._http.post(url, data, { headers, timeout });
    }

    async flush(timeoutMs = 2000) {
        try {
            if (this._inFlight.size === 0) {
                return true;
            }
            const pending = Array.from(this._inFlight);
            const allSettled = Promise.all(pending.map((p) => p.catch(() => undefined))).then(() => true);
            if (!timeoutMs || timeoutMs <= 0) {
                return false;
            }
            let timer;
            const timeout = new Promise((resolve) => {
                timer = setTimeout(() => resolve(false), timeoutMs);
                if (typeof timer.unref === 'function') {
                    timer.unref();
                }
            });
            const result = await Promise.race([allSettled, timeout]);
            clearTimeout(timer);
            return result;
        } catch (err) {
            console.warn('Cronitor flush failed:', err);
            return false;
        }
    }
}

module.exports = {
    SDK_NAME,
    SDK_VERSION,
    MAX_EVENT_BYTES,
    TRIMMED_FRAMES,
    SEND_TIMEOUT_MS,
    parseDsn,
    sdkInfo,
    authHeader,
    requestHeaders,
    formatTimestamp,
    jsonBytes,
    serializeEnvelope,
    eventBytes,
    eventEnvelope,
    Transport,
};
