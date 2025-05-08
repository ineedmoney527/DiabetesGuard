const admin = require("firebase-admin");
const { logger } = require("../utils/logger");

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split("Bearer ")[1];

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (error) {
      logger.error("Token verification error", error, {
        requestId: req.requestId,
      });
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
  } catch (error) {
    logger.error("Auth middleware error", error, {
      requestId: req.requestId,
    });
    return res.status(500).json({ message: "Server error" });
  }
};

// Middleware to check if user has MFA enabled and verify MFA code if needed
const verifyMfaIfEnabled = async (req, res, next) => {
  try {
    if (!req.user) {
      logger.warn("MFA check failed: No authenticated user", {
        requestId: req.requestId,
      });
      return res
        .status(401)
        .json({ message: "Unauthorized: User not authenticated" });
    }

    const { uid } = req.user;
    logger.debug("Checking MFA for user", {
      userId: uid,
      requestId: req.requestId,
    });
    const userDoc = await admin.firestore().collection("users").doc(uid).get();

    if (!userDoc.exists) {
      logger.warn(`MFA check failed: User not found in Firestore`, {
        userId: uid,
        requestId: req.requestId,
      });
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();
    logger.debug("User MFA status", {
      userId: uid,
      mfaEnabled: userData.mfaEnabled ? true : false,
      requestId: req.requestId,
    });

    // If MFA is not enabled, proceed to next middleware
    if (!userData.mfaEnabled) {
      logger.debug("MFA not enabled for user, proceeding with request", {
        userId: uid,
        requestId: req.requestId,
      });
      return next();
    }

    // If MFA is enabled, check for TOTP code in request headers
    const totpCode = req.headers["x-totp-code"];
    logger.debug("MFA required for request", {
      userId: uid,
      hasTotpCode: totpCode ? true : false,
      requestId: req.requestId,
    });

    if (!totpCode) {
      logger.warn("TOTP code missing from request headers", {
        userId: uid,
        requestId: req.requestId,
      });
      return res.status(403).json({
        message: "MFA required",
        requireMfa: true,
      });
    }

    // Verify TOTP code
    try {
      // Get the user's MFA secret
      if (!userData.mfaSecret) {
        logger.warn("MFA setup incomplete: No secret found", {
          userId: uid,
          requestId: req.requestId,
        });
        return res.status(400).json({ message: "MFA not properly set up" });
      }

      // Import the otplib authenticator directly here to avoid circular dependencies
      const { authenticator } = require("otplib");

      // Configure the authenticator
      authenticator.options = {
        window: 1, // Allow 1 step tolerance (30 seconds before/after)
      };

      // Verify the token - not logging the actual code
      logger.debug("Verifying TOTP code", {
        userId: uid,
        requestId: req.requestId,
      });
      const isValid = authenticator.verify({
        token: totpCode,
        secret: userData.mfaSecret,
      });

      logger.debug("TOTP verification result", {
        userId: uid,
        isValid,
        requestId: req.requestId,
      });
      if (!isValid) {
        return res.status(401).json({ message: "Invalid MFA code" });
      }

      logger.debug("MFA verification successful, proceeding with request", {
        userId: uid,
        requestId: req.requestId,
      });
      next();
    } catch (error) {
      logger.error("MFA token verification error", error, {
        userId: uid,
        requestId: req.requestId,
      });
      return res.status(401).json({ message: "Invalid MFA code" });
    }
  } catch (error) {
    logger.error("MFA verification error", error, {
      requestId: req.requestId,
    });
    return res.status(500).json({ message: "Server error" });
  }
};

// Middleware to check if user is an admin
const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User not authenticated" });
    }

    const { uid } = req.user;

    const userDoc = await admin.firestore().collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();

    if (userData.role !== "admin") {
      logger.warn("Unauthorized admin access attempt", {
        userId: uid,
        role: userData.role,
        requestId: req.requestId,
      });
      return res
        .status(403)
        .json({ message: "Forbidden: Admin access required" });
    }

    next();
  } catch (error) {
    logger.error("Admin verification error", error, {
      userId: req.user?.uid,
      requestId: req.requestId,
    });
    return res.status(500).json({ message: "Server error" });
  }
};

// Middleware to check if user is a doctor
const isDoctor = async (req, res, next) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User not authenticated" });
    }

    const { uid } = req.user;

    const userDoc = await admin.firestore().collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();

    if (userData.role !== "doctor") {
      logger.warn("Unauthorized doctor access attempt", {
        userId: uid,
        role: userData.role,
        requestId: req.requestId,
      });
      return res
        .status(403)
        .json({ message: "Forbidden: Doctor access required" });
    }

    // Check if doctor account is inactive
    if (userData.status === "inactive") {
      logger.warn("Inactive doctor access attempt", {
        userId: uid,
        status: userData.status,
        requestId: req.requestId,
      });
      return res
        .status(403)
        .json({ message: "Forbidden: Doctor account is inactive" });
    }

    next();
  } catch (error) {
    logger.error("Doctor verification error", error, {
      userId: req.user?.uid,
      requestId: req.requestId,
    });
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  verifyToken,
  verifyMfaIfEnabled,
  isAdmin,
  isDoctor,
};
