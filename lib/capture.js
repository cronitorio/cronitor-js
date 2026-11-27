const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fileURLToPath } = require('url');
const ingest = require('./ingest');

const MONITOR_TAG = 'cronitor.monitor';
const SERIES_TAG = 'cronitor.series';

const MAX_VALUE_LENGTH = 4000;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TAGS = 50;
const MAX_TAG_KEY_LENGTH = 64;
const MAX_TAG_VALUE_LENGTH = 400;
const MAX_CHAINED_EXCEPTIONS = 10;
const MAX_FRAMES = 100;
const MAX_LINE_LENGTH = 1000;
const CONTEXT_LINES = 5;

const EVENT_LEVELS = {
    fatal: 'fatal',
    critical: 'fatal',
    error: 'error',
    warning: 'warning',
    warn: 'warning',
    info: 'info',
    debug: 'debug',
};

const NODE_MODULES_RE = /(^|[\\/])node_modules([\\/]|$)/;
const STACK_PAREN_RE = /^\s*at\s+(?:async\s+)?(.+?)\s+\((.+):(\d+):(\d+)\)\s*$/;
const STACK_BARE_RE = /^\s*at\s+(?:async\s+)?(.+):(\d+):(\d+)\s*$/;

function _truncate(value, length) {
    return value.length <= length ? value : value.slice(0, length);
}

function _safeStr(value) {
    if (typeof value === 'string') {
        return value;
    }
    try {
        return String(value);
    } catch (_) {
        return '<unrepresentable>';
    }
}

function _hostname() {
    try {
        return os.hostname();
    } catch (_) {
        return '';
    }
}

function _normalizeLevel(level, fallback) {
    if (level === undefined || level === null) {
        return fallback;
    }
    const key = _safeStr(level).toLowerCase();
    return EVENT_LEVELS[key] || fallback;
}

function _isCapturableError(err) {
    if (err instanceof Error) {
        return true;
    }
    return Boolean(
        err
        && typeof err === 'object'
        && typeof err.message === 'string'
        && typeof err.stack === 'string'
    );
}

function _normalizeFilePath(rawFile) {
    if (!rawFile) {
        return '<unknown>';
    }
    if (rawFile.startsWith('file://')) {
        try {
            return fileURLToPath(rawFile);
        } catch (_) {
            return rawFile;
        }
    }
    return rawFile;
}

function _isInApp(filePath) {
    if (!filePath || filePath.startsWith('node:') || filePath.startsWith('internal/') || filePath.startsWith('<')) {
        return false;
    }
    if (NODE_MODULES_RE.test(filePath)) {
        return false;
    }
    return true;
}

function _displayFilename(filePath) {
    if (!filePath || filePath.startsWith('node:') || filePath.startsWith('internal/') || filePath.startsWith('<')) {
        return filePath;
    }
    try {
        const cwd = process.cwd();
        const rel = path.relative(cwd, filePath);
        if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
            return rel;
        }
    } catch (_) {
        // fall through to absolute path
    }
    return filePath;
}

function _sourceContext(filePath, lineno) {
    if (!filePath || !lineno || lineno < 1 || filePath.startsWith('node:') || filePath.startsWith('internal/') || filePath.startsWith('<')) {
        return { pre_context: [], context_line: null, post_context: [] };
    }
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
        return { pre_context: [], context_line: null, post_context: [] };
    }
    const lines = content.split(/\r?\n/);
    if (lineno > lines.length) {
        return { pre_context: [], context_line: null, post_context: [] };
    }
    const index = lineno - 1;
    const start = Math.max(0, index - CONTEXT_LINES);
    const end = Math.min(lines.length, index + CONTEXT_LINES + 1);
    const slice = lines.slice(start, end).map((line) => _truncate(line, MAX_LINE_LENGTH));
    const offset = index - start;
    return {
        pre_context: slice.slice(0, offset),
        context_line: slice[offset],
        post_context: slice.slice(offset + 1),
    };
}

function parseStack(stack) {
    if (!stack || typeof stack !== 'string') {
        return [];
    }
    const parsed = [];
    for (const line of stack.split('\n')) {
        let fn = '<anonymous>';
        let rawFile = null;
        let lineno = null;
        let colno = null;

        let match = STACK_PAREN_RE.exec(line);
        if (match) {
            fn = match[1];
            rawFile = match[2];
            lineno = parseInt(match[3], 10);
            colno = parseInt(match[4], 10);
        } else {
            match = STACK_BARE_RE.exec(line);
            if (match) {
                rawFile = match[1];
                lineno = parseInt(match[2], 10);
                colno = parseInt(match[3], 10);
            }
        }

        if (!rawFile || !Number.isFinite(lineno)) {
            continue;
        }

        const absPath = _normalizeFilePath(rawFile);
        const context = _sourceContext(absPath, lineno);
        const frame = {
            filename: _displayFilename(absPath),
            abs_path: absPath,
            function: fn,
            lineno,
            colno: Number.isFinite(colno) ? colno : undefined,
            context_line: context.context_line,
            pre_context: context.pre_context,
            post_context: context.post_context,
            in_app: _isInApp(absPath),
        };
        parsed.push(frame);
    }

    parsed.reverse();
    if (parsed.length > MAX_FRAMES) {
        const half = Math.floor(MAX_FRAMES / 2);
        return parsed.slice(0, half).concat(parsed.slice(-half));
    }
    return parsed;
}

function _exceptionValues(err, mechanism, handled) {
    const chain = [];
    const seen = new Set();
    let current = err;
    while (_isCapturableError(current) && !seen.has(current) && chain.length < MAX_CHAINED_EXCEPTIONS) {
        seen.add(current);
        chain.push(current);
        current = current.cause;
    }
    chain.reverse();

    return chain.map((link) => {
        const typeName = (link.name && _safeStr(link.name))
            || (link.constructor && link.constructor.name)
            || 'Error';
        return {
            type: typeName,
            value: _truncate(_safeStr(link.message || ''), MAX_VALUE_LENGTH),
            mechanism: { type: mechanism, handled },
            stacktrace: { frames: parseStack(link.stack) },
        };
    });
}

function _baseEvent(client, { level, fallbackLevel, monitor, series, tags, extra, fingerprint, env }) {
    const userTags = (tags && typeof tags === 'object' && !Array.isArray(tags)) ? Object.assign({}, tags) : {};
    const resolvedMonitor = monitor !== undefined && monitor !== null ? monitor : userTags[MONITOR_TAG];
    const resolvedSeries = series !== undefined && series !== null ? series : userTags[SERIES_TAG];
    const resolvedEnv = env !== undefined && env !== null ? env : (client._api && client._api.env);

    const boundEntries = [];
    if (resolvedMonitor !== undefined && resolvedMonitor !== null) {
        boundEntries.push([MONITOR_TAG, resolvedMonitor]);
    }
    if (resolvedSeries !== undefined && resolvedSeries !== null) {
        boundEntries.push([SERIES_TAG, resolvedSeries]);
    }

    const eventTags = {};
    let tagCount = 0;
    for (const [rawKey, rawVal] of boundEntries.concat(Object.entries(userTags))) {
        const key = _truncate(_safeStr(rawKey), MAX_TAG_KEY_LENGTH);
        if (Object.prototype.hasOwnProperty.call(eventTags, key) || tagCount >= MAX_TAGS) {
            continue;
        }
        eventTags[key] = _truncate(_safeStr(rawVal), MAX_TAG_VALUE_LENGTH);
        tagCount += 1;
    }

    const event = {
        event_id: crypto.randomBytes(16).toString('hex'),
        timestamp: ingest.formatTimestamp(),
        platform: 'node',
        level: _normalizeLevel(level, fallbackLevel),
        server_name: _hostname(),
        tags: eventTags,
        extra: (extra && typeof extra === 'object' && !Array.isArray(extra)) ? Object.assign({}, extra) : {},
        sdk: ingest.sdkInfo(),
    };

    if (fingerprint !== undefined && fingerprint !== null) {
        if (typeof fingerprint === 'string') {
            event.fingerprint = [fingerprint];
        } else if (Array.isArray(fingerprint)) {
            event.fingerprint = fingerprint.map((part) => _safeStr(part));
        }
    }
    if (client._release) {
        event.release = _safeStr(client._release);
    }
    if (resolvedEnv) {
        event.environment = _safeStr(resolvedEnv);
    }
    return event;
}

function captureException(client, error, options = {}) {
    try {
        if (!_isCapturableError(error)) {
            return null;
        }
        const opts = options || {};
        const mechanism = opts.mechanism || 'generic';
        const handled = opts.handled !== undefined ? Boolean(opts.handled) : true;
        const event = _baseEvent(client, {
            level: opts.level,
            fallbackLevel: 'error',
            monitor: opts.monitor,
            series: opts.series,
            tags: opts.tags,
            extra: opts.extra,
            fingerprint: opts.fingerprint,
            env: opts.env,
        });
        event.exception = {
            values: _exceptionValues(error, mechanism, handled),
        };
        return client._transport.submitEvent(event) ? event.event_id : null;
    } catch (err) {
        console.warn('Cronitor could not capture an exception:', err);
        return null;
    }
}

function captureMessage(client, message, options = {}) {
    try {
        if (message === undefined || message === null) {
            return null;
        }
        const opts = options || {};
        const event = _baseEvent(client, {
            level: opts.level,
            fallbackLevel: 'info',
            monitor: opts.monitor,
            series: opts.series,
            tags: opts.tags,
            extra: opts.extra,
            fingerprint: opts.fingerprint,
            env: opts.env,
        });
        event.message = {
            formatted: _truncate(_safeStr(message), MAX_MESSAGE_LENGTH),
        };
        return client._transport.submitEvent(event) ? event.event_id : null;
    } catch (err) {
        console.warn('Cronitor could not capture a message:', err);
        return null;
    }
}

module.exports = {
    MONITOR_TAG,
    SERIES_TAG,
    EVENT_LEVELS,
    parseStack,
    captureException,
    captureMessage,
};
