import logger from "./logger";

/**
 * Log Viewer utility for development mode
 *
 * This provides a simple way to visualize the logged user actions
 * by storing them in localStorage and providing functions to view them.
 */

// Enable localStorage storage for logs in development mode
if (process.env.NODE_ENV === "development") {
  // Configure logger to store logs in localStorage for development
  logger.configure({
    localStorage: true,
    level: "debug",
  });
}

/**
 * Get all stored logs from localStorage
 * @returns {Array} Array of log entries
 */
export const getAllLogs = () => {
  try {
    const logs = JSON.parse(localStorage.getItem("logs") || "[]");
    return logs;
  } catch (error) {
    console.error("Error getting logs from localStorage", error);
    return [];
  }
};

/**
 * Get only user action logs
 * @returns {Array} Array of user action log entries
 */
export const getUserActionLogs = () => {
  try {
    const logs = getAllLogs();
    return logs.filter(
      (log) =>
        log.userAction === true ||
        (log.message && log.message.includes("User action:"))
    );
  } catch (error) {
    console.error("Error filtering user action logs", error);
    return [];
  }
};

/**
 * Clear all logs from localStorage
 */
export const clearLogs = () => {
  localStorage.removeItem("logs");
};

/**
 * Print all user action logs to console
 */
export const printUserActionLogs = () => {
  const logs = getUserActionLogs();

  console.group("User Action Logs");
  console.table(
    logs.map((log) => ({
      timestamp: log.timestamp,
      action:
        log.action || (log.message && log.message.replace("User action: ", "")),
      userId: log.userId,
      details: JSON.stringify(log),
    }))
  );
  console.groupEnd();

  return logs;
};

// Development mode helpers
export const devUtils = {
  getAllLogs,
  getUserActionLogs,
  clearLogs,
  printUserActionLogs,
};

export default devUtils;
