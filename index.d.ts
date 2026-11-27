// Type definitions for cronitor
// Project: https://github.com/cronitorio/cronitor-js
// Definitions by: Cronitor <https://cronitor.io>

/// <reference types="node" />

export = Cronitor;
export as namespace Cronitor;

declare function Cronitor(apiKey?: string, config?: Cronitor.CronitorConfig): Cronitor.CronitorInstance;

declare namespace Cronitor {
    // Main Cronitor instance
    interface CronitorInstance {
        _api: ApiConfig;
        Monitor: typeof Monitor;
        Event: typeof Event;
        ErrorApp: typeof ErrorApp;
        ErrorGroup: typeof ErrorGroup;
        path?: string;
        config?: any;

        /**
         * Generate a YAML config file from monitors in your Cronitor account
         */
        generateConfig(options?: ConfigOptions): Promise<boolean>;

        /**
         * Apply/sync monitors from a YAML config file to your Cronitor account
         */
        applyConfig(options?: ConfigOptions & { rollback?: boolean }): Promise<boolean>;

        /**
         * Validate a YAML config file without applying changes
         */
        validateConfig(options?: ConfigOptions): Promise<boolean>;

        /**
         * Read and parse a YAML config file
         */
        readConfig(options?: ConfigOptions & { output?: boolean }): Promise<boolean | any>;

        /**
         * Wrap a function with Cronitor telemetry (run/complete/fail pings) and optional error capture
         */
        wrap<T extends (...args: any[]) => any>(
            key: string,
            callback: T,
            options?: WrapOptions
        ): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;

        /**
         * Wrap a cron library (node-cron or cron) to add Cronitor monitoring
         */
        wraps(lib: any): void;

        /**
         * Schedule a job with node-cron wrapper
         */
        schedule?(key: string, schedule: string, callback: () => void, options?: any): any;

        /**
         * Create a job with cron wrapper
         */
        job?(key: string, schedule: string, callback: () => void): any;

        /**
         * Generate a unique series ID for grouping related pings
         */
        newSeries(): string;

        /**
         * Capture an exception and send it to Cronitor Error Tracking.
         * Returns the event ID if queued, or null if not sent. Never throws.
         */
        captureException(error: unknown, options?: CaptureOptions): string | null;

        /**
         * Capture a message and send it to Cronitor Error Tracking.
         * Returns the event ID if queued, or null if not sent. Never throws.
         */
        captureMessage(message: string, options?: CaptureOptions): string | null;

        /**
         * Wait for in-flight error-tracking envelopes to settle, up to timeoutMs (default 2000ms).
         * Resolves true if drained, false on timeout. Never throws.
         */
        flush(timeoutMs?: number): Promise<boolean>;
    }

    // Configuration
    interface CronitorConfig {
        apiVersion?: string;
        environment?: string;
        env?: string;
        timeout?: number;
        config?: string;
        region?: string;
        dsn?: string;
        release?: string;
        captureExceptions?: boolean;
    }

    interface ConfigOptions {
        path?: string;
        group?: string;
    }

    interface WrapOptions {
        captureExceptions?: boolean;
    }

    type CaptureLevel = 'fatal' | 'critical' | 'error' | 'warning' | 'warn' | 'info' | 'debug';

    interface CaptureOptions {
        monitor?: string;
        series?: string;
        level?: CaptureLevel;
        tags?: Record<string, string | number | boolean>;
        extra?: Record<string, any>;
        fingerprint?: string | string[];
        env?: string;
    }

    interface ApiConfig {
        key: string;
        version: string | null;
        env: string | null;
        pingUrl: (key: string) => string;
        monitorUrl: (key?: string) => string;
        captureException: (error: unknown, options?: CaptureOptions) => string | null;
        captureMessage: (message: string, options?: CaptureOptions) => string | null;
        axios: any;
    }

    // Monitor class
    class Monitor {
        key: string;
        data: any;

        constructor(key: string);

        /**
         * Create or update one or more monitors
         */
        static put(data: MonitorConfig | MonitorConfig[], options?: PutOptions): Promise<Monitor | Monitor[]>;

        /**
         * Load monitor data from the API
         */
        loadData(): Promise<any>;

        /**
         * Send a ping/telemetry event
         */
        ping(params?: PingParams | string): Promise<boolean>;

        /**
         * Capture an exception bound to this monitor and its environment
         */
        captureException(error: unknown, options?: CaptureOptions): string | null;

        /**
         * Capture a message bound to this monitor and its environment
         */
        captureMessage(message: string, options?: CaptureOptions): string | null;

        /**
         * Pause alerting for a number of hours
         */
        pause(hours: number): Promise<boolean>;

        /**
         * Unpause alerting (alias for pause(0))
         */
        unpause(): Promise<boolean>;

        /**
         * Send an 'ok' ping to reset monitor to passing state
         */
        ok(params?: PingParams): Promise<boolean>;

        /**
         * Delete the monitor
         */
        delete(): Promise<boolean>;

        static readonly State: {
            RUN: 'run';
            COMPLETE: 'complete';
            FAIL: 'fail';
            OK: 'ok';
        };

        static readonly requestType: {
            JSON: 'json';
            YAML: 'yaml';
        };
    }

    // Monitor configuration
    interface MonitorConfig {
        type?: 'job' | 'check' | 'heartbeat' | 'errors';
        key: string;
        schedule?: string;
        assertions?: string[];
        notify?: string[];
        request?: {
            url: string;
            regions?: string[];
            method?: string;
            headers?: Record<string, string>;
            body?: string;
            timeout?: number;
            follow_redirects?: boolean;
        };
        trigger?: 'new' | 'regression' | 'spike';
        apps?: string[];
        filters?: Record<string, any>;
        threshold?: number;
        window?: string;
        per?: string;
        tags?: string[];
        note?: string;
        grace_seconds?: number;
        realert_interval?: string;
        platform?: string;
        timezone?: string;
        environments?: string[];
        metadata?: Record<string, any>;
    }

    interface PutOptions {
        rollback?: boolean;
        format?: 'json' | 'yaml';
    }

    // Ping parameters
    interface PingParams {
        state?: 'run' | 'complete' | 'fail' | 'ok';
        message?: string;
        metrics?: {
            duration?: number;
            count?: number;
            error_count?: number;
            [key: string]: number | undefined;
        };
        series?: string;
        host?: string;
        env?: string;
        stamp?: number;
    }

    // Event class
    class Event {
        monitor: Monitor;
        intervalSeconds: number;
        intervalId: NodeJS.Timeout | null;

        constructor(key: string, options?: EventOptions);

        /**
         * Increment the tick counter
         */
        tick(count?: number): void;

        /**
         * Increment the error counter
         */
        error(): void;

        /**
         * Stop the event and flush remaining counts
         */
        stop(): Promise<boolean>;

        /**
         * Stop the event and send a fail ping
         */
        fail(message?: string | null): Promise<void>;
    }

    interface EventOptions {
        intervalSeconds?: number;
    }

    // ErrorApp REST resource
    interface ErrorAppData {
        key: string;
        name: string;
        dsn?: string;
        [key: string]: any;
    }

    interface ErrorAppCreateOptions {
        name: string;
        [key: string]: any;
    }

    interface ErrorAppUpdateOptions {
        name?: string;
        [key: string]: any;
    }

    interface ErrorAppListOptions {
        page?: number;
        pageSize?: number;
        autoPaginate?: boolean;
    }

    class ErrorApp {
        key: string;
        data: ErrorAppData | null;
        readonly dsn: string | undefined;

        constructor(key: string);

        static create(options: ErrorAppCreateOptions): Promise<ErrorApp>;
        static list(options?: ErrorAppListOptions): Promise<ErrorApp[]>;

        loadData(): Promise<ErrorAppData>;
        update(options: ErrorAppUpdateOptions): Promise<ErrorApp>;
        delete(): Promise<boolean>;
        rotateKey(): Promise<ErrorApp>;
    }

    // ErrorGroup REST resource
    interface ErrorGroupData {
        key: string;
        title?: string;
        status?: string;
        level?: string;
        [key: string]: any;
    }

    interface ErrorGroupListOptions {
        app?: string;
        env?: string;
        status?: string;
        level?: string;
        start?: string;
        end?: string;
        q?: string;
        orderBy?: string;
        page?: number;
        pageSize?: number;
        autoPaginate?: boolean;
    }

    interface ErrorGroupUpdateOptions {
        status: string;
        env?: string;
    }

    interface ErrorGroupEventsOptions {
        env?: string;
        app?: string;
        cursor?: string;
        limit?: number;
    }

    interface ErrorEventData {
        event_id: string;
        [key: string]: any;
    }

    interface ErrorGroupEventsResponse {
        data: ErrorEventData[];
        next_cursor?: string | null;
        [key: string]: any;
    }

    class ErrorGroup {
        key: string;
        data: ErrorGroupData | null;

        constructor(key: string);

        static list(options?: ErrorGroupListOptions): Promise<ErrorGroup[]>;

        loadData(): Promise<ErrorGroupData>;
        update(options: ErrorGroupUpdateOptions): Promise<ErrorGroup>;
        events(options?: ErrorGroupEventsOptions): Promise<ErrorGroupEventsResponse>;
        event(eventId: string): Promise<ErrorEventData>;
    }

    // Error classes
    class MonitorNotCreated extends Error {
        constructor(message?: string);
    }

    class ConfigError extends Error {
        constructor(message?: string);
    }

    class InvalidMonitor extends Error {
        constructor(message?: string);
    }

    class ErrorAppNotFound extends Error {
        constructor(message?: string);
    }

    class ErrorGroupNotFound extends Error {
        constructor(message?: string);
    }
}
