const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { body, validationResult } = require("express-validator");
const {
  generateTotpSecret,
  generateQrCode,
  verifyTotpToken,
  enableMfa,
  disableMfa,
} = require("../utils/mfa");
const { encrypt, decrypt } = require("../utils/encryption");
const { logger } = require("../utils/logger");

// Middleware to verify Firebase ID token
const verifyToken = async (req, res, next) => {
  try {
    const idToken = req.headers.authorization?.split("Bearer ")[1];

    if (!idToken) {
      logger.warn("Authentication failed: No token provided", {
        requestId: req.requestId,
        path: req.path,
      });
      return res.status(401).json({ message: "No token provided" });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;

    logger.debug("Token verified successfully", {
      userId: decodedToken.uid,
      requestId: req.requestId,
    });

    next();
  } catch (error) {
    logger.error("Error verifying token", error, {
      requestId: req.requestId,
      path: req.path,
    });
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Check if user is authenticated
router.get("/check", verifyToken, async (req, res) => {
  try {
    // Get user data including MFA status
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(req.user.uid)
      .get();

    if (!userDoc.exists) {
      logger.warn("User not found during auth check", {
        userId: req.user.uid,
        requestId: req.requestId,
      });
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();

    // Check if MFA is enabled and TOTP code is provided
    if (userData.mfaEnabled) {
      const totpCode = req.headers["x-totp-code"];
      logger.debug(`Auth check with MFA enabled`, {
        userId: req.user.uid,
        requestId: req.requestId,
        mfaCodePresent: !!totpCode,
      });

      if (!totpCode) {
        // MFA required but code not provided
        logger.info("MFA required but code not provided", {
          userId: req.user.uid,
          requestId: req.requestId,
        });
        return res.status(403).json({
          message: "MFA required",
          requireMfa: true,
          authenticated: false,
        });
      } else {
        // Verify TOTP code
        try {
          if (!userData.mfaSecret) {
            logger.warn("MFA setup incomplete: No secret found", {
              userId: req.user.uid,
              requestId: req.requestId,
            });
            return res.status(400).json({ message: "MFA not properly set up" });
          }

          // Import the otplib authenticator
          const { authenticator } = require("otplib");

          // Configure the authenticator
          authenticator.options = {
            window: 1, // Allow 1 step tolerance (30 seconds before/after)
          };

          // Verify the token
          logger.debug(`Verifying TOTP code during auth check`, {
            userId: req.user.uid,
            requestId: req.requestId,
            totpCodePrefix: totpCode.substring(0, 2),
          });
          const isValid = authenticator.verify({
            token: totpCode,
            secret: userData.mfaSecret,
          });

          logger.debug(`Auth check TOTP verification result`, {
            userId: req.user.uid,
            requestId: req.requestId,
            isValid,
          });

          if (!isValid) {
            logger.warn("Invalid MFA code provided", {
              userId: req.user.uid,
              requestId: req.requestId,
            });
            return res.status(401).json({ message: "Invalid MFA code" });
          }

          // TOTP code valid, continue with response
          logger.info("MFA verification successful", {
            userId: req.user.uid,
            requestId: req.requestId,
          });
        } catch (error) {
          logger.error("MFA verification error during auth check", error, {
            userId: req.user.uid,
            requestId: req.requestId,
          });
          return res.status(401).json({ message: "Invalid MFA code" });
        }
      }
    }

    // User authenticated (and MFA verified if needed)
    logger.info("User authenticated successfully", {
      userId: req.user.uid,
      requestId: req.requestId,
      emailVerified: req.user.email_verified,
      role: userData.role || "unknown",
      mfaEnabled: userData.mfaEnabled || false,
    });

    res.status(200).json({
      authenticated: true,
      user: {
        uid: req.user.uid,
        email: req.user.email,
        emailVerified: req.user.email_verified,
        role: userData.role || "unknown",
        mfaEnabled: userData.mfaEnabled || false,
      },
    });
  } catch (error) {
    logger.error("Error checking authentication", error, {
      userId: req.user?.uid,
      requestId: req.requestId,
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Register a new user
// POST /auth/createProfile
router.post(
  "/createProfile",
  [
    body("uid").notEmpty().withMessage("UID is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("name").notEmpty().withMessage("Name is required"),
    body("gender").notEmpty().withMessage("Gender is required"),
    body("birthdate").isDate().withMessage("Valid birthdate is required"),
    body("role")
      .isIn(["employee", "doctor"])
      .withMessage("Role must be employee or doctor"),
    body("position").custom((value, { req }) => {
      if (req.body.role === "employee" && !value) {
        throw new Error("Position is required for employees");
      }
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn("Profile creation validation failed", {
        requestId: req.requestId,
        errors: errors.array(),
      });
      return res.status(400).json({ errors: errors.array() });
    }

    const { uid, email, name, gender, birthdate, role, position } = req.body;

    try {
      // Check if user doc already exists
      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .get();
      if (userDoc.exists) {
        logger.warn("Profile creation failed: Profile already exists", {
          requestId: req.requestId,
          userId: uid,
        });
        return res
          .status(400)
          .json({ message: "Profile already exists for this user." });
      }

      const status = role === "doctor" ? "inactive" : "active";

      // Encrypt sensitive user data
      const sensitiveData = encrypt({
        name,
        gender,
        birthdate,
        position: position || null,
      });

      await admin.firestore().collection("users").doc(uid).set({
        email,
        role,
        status,
        sensitiveData, // Store encrypted sensitive data
        mfaEnabled: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.userAction(uid, "profile_created", {
        email,
        role,
        status,
      });

      res
        .status(201)
        .json({ message: "Profile created successfully", uid, role, status });
    } catch (error) {
      logger.error("Create profile error", error, {
        requestId: req.requestId,
        userId: uid,
      });
      res
        .status(500)
        .json({ message: "Failed to create profile", error: error.message });
    }
  }
);

router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    body("name").notEmpty().withMessage("Name is required"),
    body("gender").notEmpty().withMessage("Gender is required"),
    // body("phone").notEmpty().withMessage("Phone is required"),
    body("birthdate").isDate().withMessage("Valid birthdate is required"),
    body("role")
      .isIn(["employee", "doctor"])
      .withMessage("Role must be employee or doctor"),
    body("position").custom((value, { req }) => {
      if (req.body.role === "employee" && !value) {
        throw new Error("Position is required for employees");
      }
      return true;
    }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, gender, birthdate, role, position } =
        req.body;

      // Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: name,
        emailVerified: false,
      });

      // Send email verification
      const emailVerificationLink = await admin
        .auth()
        .generateEmailVerificationLink(email);

      // Encrypt sensitive user data
      const sensitiveData = encrypt({
        name,
        gender,
        birthdate,
        position: position || null,
      });

      // Create user document in Firestore
      const status = role === "doctor" ? "inactive" : "active";

      await admin.firestore().collection("users").doc(userRecord.uid).set({
        email,
        role,
        status,
        sensitiveData, // Store encrypted sensitive data
        mfaEnabled: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log user registration
      logger.userAction(userRecord.uid, "user_register", {
        requestId: req.requestId,
        email,
        role,
        status,
      });

      res.status(201).json({
        message: "User registered successfully",
        uid: userRecord.uid,
        status,
        emailVerificationLink,
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error.code === "auth/email-already-exists") {
        return res.status(400).json({ message: "Email already in use." });
      }
      res.status(500).json({
        message: "Failed to register user",
        error: error.message,
      });
    }
  }
);

// MFA setup endpoint - generates secret and QR code
router.post("/mfa/setup", verifyToken, async (req, res) => {
  try {
    const { uid, email } = req.user;

    // Generate new TOTP secret
    const secret = await generateTotpSecret(uid);

    // Generate QR code
    const qrCode = await generateQrCode(secret, email);

    // Log MFA setup initiation
    logger.userAction(uid, "mfa_setup_initiated", {
      requestId: req.requestId,
      email,
    });

    res.status(200).json({
      secret,
      qrCode,
      message: "MFA setup initiated. Verify with a code to complete setup.",
    });
  } catch (error) {
    logger.error("MFA setup error", error, {
      // Pass the actual error object
      userId: req.user.uid, // Add context if available
      requestId: req.requestId,
    });
    res
      .status(500)
      .json({ message: "Failed to set up MFA", error: error.message });
  }
});

// Verify and enable MFA
router.post("/mfa/verify", verifyToken, async (req, res) => {
  try {
    const { token, secret } = req.body;
    const { uid } = req.user;

    if (!token) {
      return res.status(400).json({ message: "Verification code is required" });
    }

    // Get user data to check if MFA is already set up
    const userDoc = await admin.firestore().collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();

    if (!userData.mfaSecret) {
      return res.status(400).json({ message: "MFA setup not initiated" });
    }

    if (userData.mfaEnabled) {
      return res.status(400).json({ message: "MFA is already enabled" });
    }

    // Verify token with secret
    const isValid = await verifyTotpToken(uid, token);

    if (!isValid) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Enable MFA
    await enableMfa(uid);

    // Log MFA enabled
    logger.userAction(uid, "mfa_enabled", {
      requestId: req.requestId,
    });

    res.status(200).json({ message: "MFA enabled successfully" });
  } catch (error) {
    console.error("MFA verification error:", error);
    res
      .status(500)
      .json({ message: "Failed to verify MFA", error: error.message });
  }
});

// Disable MFA
router.post("/mfa/disable", verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    // Disable MFA
    await disableMfa(uid);

    // Log MFA disabled
    logger.userAction(uid, "mfa_disabled", {
      requestId: req.requestId,
    });

    res.status(200).json({ message: "MFA disabled successfully" });
  } catch (error) {
    console.error("MFA disable error:", error);
    res
      .status(500)
      .json({ message: "Failed to disable MFA", error: error.message });
  }
});

// Check MFA status
router.get("/mfa/status", verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;

    const userDoc = await admin.firestore().collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();

    res.status(200).json({
      mfaEnabled: userData.mfaEnabled || false,
    });
  } catch (error) {
    console.error("MFA status error:", error);
    res
      .status(500)
      .json({ message: "Failed to get MFA status", error: error.message });
  }
});

// Test route
router.get("/test", (req, res) => {
  res.status(200).json({ message: "Auth routes working" });
});

// Check if user exists by email
router.post("/check-user-exists", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Try to get user by email
    const userRecord = await admin
      .auth()
      .getUserByEmail(email)
      .then(() => true)
      .catch((error) => {
        if (error.code === "auth/user-not-found") {
          return false;
        }
        throw error;
      });

    // Return whether the user exists, without exposing other information
    res.status(200).json({ exists: userRecord });
  } catch (error) {
    console.error("Error checking if user exists:", error);
    // For security reasons, return false instead of an error
    res.status(200).json({ exists: false });
  }
});

module.exports = router;
