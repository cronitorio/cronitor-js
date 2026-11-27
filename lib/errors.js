class MonitorNotCreated extends Error {}
class ConfigError extends Error {}
class InvalidMonitor extends Error {}
class ErrorAppNotFound extends Error {}
class ErrorGroupNotFound extends Error {}

module.exports = {
    MonitorNotCreated,
    ConfigError,
    InvalidMonitor,
    ErrorAppNotFound,
    ErrorGroupNotFound,
};
