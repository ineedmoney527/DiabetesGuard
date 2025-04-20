const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { verifyToken, isAdmin, isDoctor } = require("../middleware/auth");

// Middleware to verify admin role
const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(decodedToken.uid)
      .get();
    const userData = userDoc.data();

    if (userData.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    req.user = { uid: decodedToken.uid, ...userData };
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ message: "Invalid token" });
  }
};

// Get all users (admin only)
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const usersSnapshot = await admin.firestore().collection("users").get();
    const users = [];

    usersSnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// Approve doctor account (admin only)
router.post("/approve-doctor/:userId", verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();
    if (userData.role !== "doctor") {
      return res.status(400).json({ message: "User is not a doctor" });
    }

    await admin.firestore().collection("users").doc(userId).update({
      status: "active",
    });

    // Add to action history
    await admin.firestore().collection("adminActions").add({
      userId,
      userName: userData.name,
      action: "approved",
      adminId: req.user.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "Doctor account approved successfully" });
  } catch (error) {
    console.error("Error approving doctor:", error);
    res.status(500).json({ message: "Error approving doctor account" });
  }
});

// Delete user (admin only)
router.delete("/:userId", verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user data before deletion to store in history
    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();

    // Delete from Firebase Auth
    await admin.auth().deleteUser(userId);

    // Delete from Firestore
    await admin.firestore().collection("users").doc(userId).delete();

    // Add to action history
    await admin.firestore().collection("adminActions").add({
      userId,
      userName: userData.name,
      action: "deleted",
      adminId: req.user.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error deleting user" });
  }
});

// Get user profile
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();

    // Calculate age from birthdate
    const birthdate = new Date(userData.birthdate);
    const age = Math.floor(
      (new Date() - birthdate) / (365.25 * 24 * 60 * 60 * 1000)
    );

    // Return user profile data
    res.status(200).json({
      id: userId,
      email: userData.email,
      name: userData.name,
      birthdate: userData.birthdate,
      gender: userData.gender,
      role: userData.role,
      status: userData.status || "active",
      age: age,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Error fetching user profile" });
  }
});

// Update user profile
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { name, gender, birthdate } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    if (!gender) {
      return res.status(400).json({ message: "Gender is required" });
    }

    if (!birthdate) {
      return res.status(400).json({ message: "Birthdate is required" });
    }

    // Get current user data
    const userRef = admin.firestore().collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update Firebase display name if changed
    const userData = userDoc.data();
    if (userData.name !== name) {
      const firebaseUser = await admin.auth().getUser(userId);
      if (firebaseUser.displayName !== name) {
        await admin.auth().updateUser(userId, { displayName: name });
      }
    }

    // Update Firestore document
    await userRef.update({
      name,
      gender,
      birthdate,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ message: "Error updating user profile" });
  }
});

// Get a doctor's patients
router.get("/patients", verifyToken, isDoctor, async (req, res) => {
  try {
    // Get all patients with role="employee"
    const allPatientsSnapshot = await admin
      .firestore()
      .collection("users")
      .where("role", "==", "employee")
      .get();

    if (allPatientsSnapshot.empty) {
      return res.status(200).json([]);
    }

    // Get the patient data
    const patientsData = [];

    for (const patientDoc of allPatientsSnapshot.docs) {
      const patientId = patientDoc.id;
      const patientData = patientDoc.data();

      // Get latest health data if available
      const healthSnapshot = await admin
        .firestore()
        .collection("healthData")
        .where("userId", "==", patientId)
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();

      let latestHealthData = null;
      if (!healthSnapshot.empty) {
        const healthData = healthSnapshot.docs[0].data();
        latestHealthData = {
          ...healthData,
          timestamp: healthData.timestamp?.toDate(),
        };
      }

      patientsData.push({
        id: patientId,
        email: patientData.email,
        name: patientData.name,
        birthdate: patientData.birthdate,
        gender: patientData.gender,
        position: patientData.position || null,
        latestHealthData,
      });
    }

    res.status(200).json(patientsData);
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ message: "Error fetching patients" });
  }
});

// Reject doctor account (admin only)
router.post("/reject-doctor/:userId", verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const userDoc = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();
    if (userData.role !== "doctor") {
      return res.status(400).json({ message: "User is not a doctor" });
    }

    await admin.firestore().collection("users").doc(userId).update({
      status: "rejected",
    });

    // Add to action history
    await admin.firestore().collection("adminActions").add({
      userId,
      userName: userData.name,
      action: "rejected",
      adminId: req.user.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "Doctor account rejected successfully" });
  } catch (error) {
    console.error("Error rejecting doctor:", error);
    res.status(500).json({ message: "Error rejecting doctor account" });
  }
});

// Get action history (admin only)
router.get("/action-history", verifyAdmin, async (req, res) => {
  try {
    const historySnapshot = await admin
      .firestore()
      .collection("adminActions")
      .orderBy("timestamp", "desc")
      .get();

    const history = [];
    historySnapshot.forEach((doc) => {
      history.push({
        id: doc.id,
        ...doc.data(),
        timestamp:
          doc.data().timestamp?.toDate().toISOString() ||
          new Date().toISOString(),
      });
    });

    res.json(history);
  } catch (error) {
    console.error("Error fetching action history:", error);
    res.status(500).json({ message: "Error fetching action history" });
  }
});

module.exports = router;
