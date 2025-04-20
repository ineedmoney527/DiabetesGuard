const admin = require("firebase-admin");

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
      console.error("Token verification error:", error);
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
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
      return res
        .status(403)
        .json({ message: "Forbidden: Admin access required" });
    }

    next();
  } catch (error) {
    console.error("Admin verification error:", error);
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
      return res
        .status(403)
        .json({ message: "Forbidden: Doctor access required" });
    }

    // Check if doctor account is inactive
    if (userData.status === "inactive") {
      return res
        .status(403)
        .json({ message: "Forbidden: Doctor account is inactive" });
    }

    next();
  } catch (error) {
    console.error("Doctor verification error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  verifyToken,
  // verifyMfaEnrollment,
  isAdmin,
  isDoctor,
};
