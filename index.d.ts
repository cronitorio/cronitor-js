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
         * Wrap a function with Cronitor telemetry (run/complete/fail pings)
         */
        wrap<T extends (...args: any[]) => any>(key: string, callback: T): (...args: Parameters<T>) => Promise<ReturnType<T>>;

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
    }

    // Configuration
    interface CronitorConfig {
        apiVersion?: string;
        environment?: string;
        env?: string;
        timeout?: number;
        config?: string;
        region?: string;
    }

    interface ConfigOptions {
        path?: string;
        group?: string;
    }

    interface ApiConfig {
        key: string;
        version: string | null;
        env: string | null;
        pingUrl: (key: string) => string;
        monitorUrl: (key?: string) => string;
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
        type?: 'job' | 'check' | 'heartbeat';
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
}
