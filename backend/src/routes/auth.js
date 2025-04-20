const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { body, validationResult } = require("express-validator");

// Middleware to verify Firebase ID token
const verifyToken = async (req, res, next) => {
  try {
    const idToken = req.headers.authorization?.split("Bearer ")[1];

    if (!idToken) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Check if user is authenticated
router.get("/check", verifyToken, (req, res) => {
  res.status(200).json({
    authenticated: true,
    user: {
      uid: req.user.uid,
      email: req.user.email,
      emailVerified: req.user.email_verified,
    },
  });
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
        return res
          .status(400)
          .json({ message: "Profile already exists for this user." });
      }

      const status = role === "doctor" ? "inactive" : "active";

      await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .set({
          email,
          name,
          gender,
          birthdate,
          role,
          position: position || null,
          status,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      res
        .status(201)
        .json({ message: "Profile created successfully", uid, role, status });
    } catch (error) {
      console.error("Create profile error:", error);
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

      // Create user document in Firestore
      const status = role === "doctor" ? "inactive" : "active";

      await admin
        .firestore()
        .collection("users")
        .doc(userRecord.uid)
        .set({
          name,
          email,
          gender,
          birthdate,
          role,
          position: position || null,
          status,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      res.status(201).json({
        message: "User registered successfully. Please verify your email.",
        userId: userRecord.uid,
        role,
        status,
        emailVerificationLink, // In a production app, you would send this via email, not return it
      });
    } catch (error) {
      console.error("Registration error:", error);

      if (error.code === "auth/email-already-exists") {
        return res.status(400).json({ message: "Email already in use" });
      }

      res
        .status(500)
        .json({ message: "Registration failed", error: error.message });
    }
  }
);

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
