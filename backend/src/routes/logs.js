const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { verifyToken } = require("../middleware/auth");
const { logger } = require("../utils/logger");

/**
 * POST /logs - Store logs from frontend
 *
 * This endpoint accepts logs from the frontend application and
 * forwards them to the structured logging system
 */
router.post("/", async (req, res) => {
  try {
    const { logs } = req.body;

    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ message: "Invalid log format" });
    }

    // Process each log
    logs.forEach((logEntry) => {
      const { level, message, userId, sessionId, url, ...metadata } = logEntry;

      // Determine the appropriate log level
      const logLevel = ["debug", "info", "warn", "error"].includes(level)
        ? level
        : "info";

      // Log using the backend structured logger
      logger[logLevel](`Frontend: ${message}`, {
        source: "frontend",
        component: "frontend",
        service: "diabetes-guard",
        userId,
        sessionId,
        url,
        ...metadata,
      });
    });

    res.status(200).json({ message: "Logs received" });
  } catch (error) {
    logger.error("Error processing frontend logs", error);
    res.status(500).json({ message: "Error processing logs" });
  }
});

// For authenticated logs (with additional user context)
router.post("/authenticated", verifyToken, async (req, res) => {
  try {
    const { logs } = req.body;

    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ message: "Invalid log format" });
    }

    // Process each log with authenticated user context
    logs.forEach((logEntry) => {
      const { level, message, sessionId, url, ...metadata } = logEntry;

      // Determine the appropriate log level
      const logLevel = ["debug", "info", "warn", "error"].includes(level)
        ? level
        : "info";

      // Log using the backend structured logger with verified user ID
      logger[logLevel](`Frontend: ${message}`, {
        source: "frontend",
        component: "frontend",
        service: "diabetes-guard",
        userId: req.user.uid, // Use verified user ID from token
        sessionId,
        url,
        ...metadata,
      });
    });

    res.status(200).json({ message: "Authenticated logs received" });
  } catch (error) {
    logger.error("Error processing authenticated frontend logs", error, {
      userId: req.user ? req.user.uid : null,
    });
    res.status(500).json({ message: "Error processing logs" });
  }
});

module.exports = router;
