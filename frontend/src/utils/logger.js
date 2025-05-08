/**
 * Frontend Structured Logger
 *
 * This module provides structured logging for the frontend that can
 * optionally send logs to the backend for centralized storage.
 */

// Default log level based on environment
const DEFAULT_LOG_LEVEL =
  process.env.NODE_ENV === "production" ? "warn" : "debug";

// Log levels
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Configuration object
let config = {
  level: DEFAULT_LOG_LEVEL,
  sendToServer: process.env.NODE_ENV === "production", // Only send logs to server in production by default
  serverEndpoint: "/api/logs",
  batchSize: 10, // Number of logs to batch before sending
  console: true, // Log to console
  localStorage: false, // Store logs in localStorage
};

// Log queue for batching
let logQueue = [];

// Generate a unique session ID
const generateSessionId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Session ID for grouping logs
const sessionId = generateSessionId();

/**
 * Configure the logger
 * @param {Object} options - Configuration options
 */
const configure = (options = {}) => {
  config = { ...config, ...options };
};

/**
 * Format a log entry
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 * @returns {Object} - Formatted log entry
 */
const formatLogEntry = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const userId = localStorage.getItem("userId") || null;

  // Include component and service labels for unified logging
  // All logs use the same logName but can be filtered by component in Cloud Logging
  return {
    timestamp,
    level,
    message,
    userId,
    sessionId,
    url: window.location.href,
    userAgent: navigator.userAgent,
    component: "frontend",
    service: "diabetes-guard",
    ...data,
  };
};

/**
 * Send logs to the server
 * @param {Array} logs - Array of log entries
 */
const sendLogsToServer = async (logs) => {
  if (!config.sendToServer || !logs.length) return;

  try {
    const token = localStorage.getItem("token");

    await fetch(config.serverEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ logs }),
    });
  } catch (error) {
    // Fallback to console if server logging fails
    if (config.console) {
      console.error("Failed to send logs to server", error);
    }
  }
};

/**
 * Process the log queue
 */
const processLogQueue = () => {
  if (logQueue.length >= config.batchSize) {
    const logsToSend = [...logQueue];
    logQueue = [];
    sendLogsToServer(logsToSend);
  }
};

/**
 * Store log in localStorage
 * @param {Object} logEntry - Log entry
 */
const storeInLocalStorage = (logEntry) => {
  if (!config.localStorage) return;

  try {
    const logs = JSON.parse(localStorage.getItem("logs") || "[]");
    logs.push(logEntry);

    // Keep only last 100 logs to avoid exceeding localStorage limits
    if (logs.length > 100) {
      logs.shift();
    }

    localStorage.setItem("logs", JSON.stringify(logs));
  } catch (error) {
    console.error("Failed to store log in localStorage", error);
  }
};

/**
 * Base logging function
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
const log = (level, message, data = {}) => {
  // Check if log level is enabled
  if (LOG_LEVELS[level] < LOG_LEVELS[config.level]) {
    return;
  }

  const logEntry = formatLogEntry(level, message, data);

  // Log to console if enabled
  if (config.console) {
    const consoleMethod = level === "debug" ? "log" : level;
    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, data);
  }

  // Store in localStorage if enabled
  if (config.localStorage) {
    storeInLocalStorage(logEntry);
  }

  // Add to queue for server sending
  if (config.sendToServer) {
    logQueue.push(logEntry);
    processLogQueue();
  }
};

/**
 * Log at debug level
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
const debug = (message, data = {}) => {
  log("debug", message, data);
};

/**
 * Log at info level
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
const info = (message, data = {}) => {
  log("info", message, data);
};

/**
 * Log at warn level
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
const warn = (message, data = {}) => {
  log("warn", message, data);
};

/**
 * Log at error level
 * @param {string} message - Log message
 * @param {Error|null} error - Error object
 * @param {Object} data - Additional data
 */
const error = (message, error = null, data = {}) => {
  const errorData = error
    ? {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack,
        ...data,
      }
    : data;

  log("error", message, errorData);
};

/**
 * Log user actions
 * @param {string} action - User action
 * @param {Object} details - Action details
 */
const userAction = (action, details = {}) => {
  info(`User action: ${action}`, {
    userAction: true,
    action,
    ...details,
  });
};

/**
 * Log performance metrics
 * @param {string} name - Metric name
 * @param {number} duration - Duration in milliseconds
 * @param {Object} data - Additional data
 */
const logPerformance = (name, duration, data = {}) => {
  info(`Performance: ${name}`, {
    performance: true,
    name,
    duration,
    ...data,
  });
};

/**
 * Create a performance timer
 * @param {string} name - Timer name
 * @returns {Object} - Timer object with stop method
 */
const startTimer = (name) => {
  // Safely get the performance.now() function, or fallback to Date
  const getNow = () => {
    if (
      typeof window !== "undefined" &&
      window.performance &&
      typeof window.performance.now === "function"
    ) {
      return window.performance.now();
    }
    return Date.now();
  };

  const startTime = getNow();

  return {
    stop: (data = {}) => {
      const duration = getNow() - startTime;
      logPerformance(name, duration, data);
      return duration;
    },
  };
};

/**
 * Log navigation events
 * @param {string} from - Previous route
 * @param {string} to - New route
 */
const navigation = (from, to) => {
  info("Navigation", {
    navigation: true,
    from,
    to,
  });
};

/**
 * Flush logs to the server immediately
 */
const flush = async () => {
  if (logQueue.length > 0) {
    const logsToSend = [...logQueue];
    logQueue = [];
    await sendLogsToServer(logsToSend);
  }
};

// Flush logs on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    flush();
  });
}

// Export logger functions
const logger = {
  configure,
  debug,
  info,
  warn,
  error,
  userAction,
  performance: logPerformance,
  startTimer,
  navigation,
  flush,
  sessionId,
};

export default logger;
