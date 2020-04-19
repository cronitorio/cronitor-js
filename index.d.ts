type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';

interface BareMonitor {
  name: string;
  notifications: {
    phones?: string[];
    webhooks?: string[];
    emails?: string[];
    slack?: string[];
    pagerduty?: string[];
    webhooks?: string[];
  };
  tags?: string[];
  note?: string;
}

interface HeartbeatMonitor extends BareMonitor {
  type: 'heartbeat';
  request_interval_seconds: number;
  rules: HearbeatRule[];
  request: {
    url: string;
    method: 'GET' | 'HEAD' | 'PATCH' | 'POST' | 'PUT';
    body?: string;
    headers?: { [k: string]: value };
    cookies?: { [k: string]: value };
    timeout_seconds?: number;
  };
}

interface HealthcheckMonitor extends BareMonitor {
  type: 'healthcheck';
  request_interval_seconds: number;
  rules: HealthcheckRule[];
  request: {
    url: string;
    method: 'GET' | 'HEAD' | 'PATCH' | 'POST' | 'PUT';
    body?: string;
    headers?: { [k: string]: value };
    cookies?: { [k: string]: value };
    timeout_seconds?: number;
  };
}

interface HearbeatRule {
  rule_type:
    | 'not_on_schedule'
    | 'run_ping_not_received'
    | 'complete_ping_not_received'
    | 'ran_longer_than'
    | 'ran_less_than'
    | 'run_ping_received'
    | 'complete_ping_received';
  value?: number | string;
  human_readable: string;
  time_unit: TimeUnit;
  hours_to_followup_alert?: number;
  grace_seconds?: number;
}

interface HealthcheckRule {
  rule_type: 'response_time' | 'response_code' | 'response_body';
  operator: 'eq' | 'lt' | 'lte' | 'gt' | 'gte' | 'not' | 'contains';
  value: any;
  hours_to_followup_alert?: number;
}

type Monitor = HealthcheckMonitor | HeartbeatMonitor;

type CreatedMonitor = Monitor & {
  created: string;
  has_duration_history: boolean;
  status: boolean;
  disabled: boolean;
  passing: boolean;
  paused: boolean;
  initialized: boolean;
  code: string;
};

class Cronitor {
  constructor(
    param: ({ code: string } | { monitorApiKey: string }) & {
      authKey?: string;
    }
  );
  get(): Promise<CreatedMonitor>;
  create(monitor: Monitor): Promise<any>;
  createCron(config: {
    expression: string;
    name: string;
    notificationLists: string[];
    graceSeconds?: number;
  }): Promise<any>;
  createHeartbeat(config: {
    name: string;
    notificationLists: string[];
  } & ({
    every: [number, TimeUnit]
  } | { at: string }))
  filter(params: {
    page: number;
    tagFilter: string;
    codeFilter: string;
    nameFilter: string;
  }): Promise<{
    monitors: CreatedMonitor[];
    page_size: number;
    page: number;
    total_monitor_count: number;
  }>;
  update(monitor: Monitor): Promise<any>;
  run(message?: string): Promise<any>;
  complete(message?: string): Promise<any>;
  pause(time: number): Promise<any>;
  unpause(): Promise<any>;
  fail(message?: string): Promise<any>;
}

declare module 'cronitor' {
  export = Cronitor;
}
