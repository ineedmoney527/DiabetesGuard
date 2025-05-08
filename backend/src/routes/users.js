const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { encrypt, decrypt } = require("../utils/encryption");
const {
  verifyToken,
  isAdmin,
  isDoctor,
  verifyMfaIfEnabled,
} = require("../middleware/auth");
const { logger } = require("../utils/logger");

// Helper function to encrypt sensitive user data
const encryptUserData = (userData) => {
  const sensitiveData = {
    name: userData.name,
    birthdate: userData.birthdate,
    gender: userData.gender,
    position: userData.position || null,
    phone: userData.phone || null,
    address: userData.address || null,
  };

  // Save in encrypted form
  return encrypt(sensitiveData);
};

// Helper function to decrypt user data
const decryptUserData = (encryptedData, baseUserData) => {
  try {
    if (!encryptedData) return baseUserData;

    const decryptedData = decrypt(encryptedData);
    return { ...baseUserData, ...decryptedData };
  } catch (error) {
    console.error("Error decrypting user data:", error);
    return baseUserData;
  }
};

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
      const userData = doc.data();
      let userDataDecrypted = { id: doc.id, ...userData };

      // Decrypt sensitive data if present
      if (userData.sensitiveData) {
        userDataDecrypted = decryptUserData(
          userData.sensitiveData,
          userDataDecrypted
        );
        // Remove encrypted data from response
        delete userDataDecrypted.sensitiveData;
      }

      users.push(userDataDecrypted);
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

    // Decrypt sensitive data to get the user's name
    let userName = "Unknown";
    if (userData.sensitiveData) {
      try {
        const decryptedData = decrypt(userData.sensitiveData);
        userName = decryptedData.name || "Unknown";
      } catch (decryptError) {
        console.error("Error decrypting user data:", decryptError);
      }
    }

    // Add to action history
    await admin.firestore().collection("adminActions").add({
      userId,
      userName,
      action: "approved",
      adminId: req.user.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log admin action
    logger.userAction(req.user.uid, "approve_doctor", {
      doctorId: userId,
      doctorName: userName,
      requestId: req.requestId,
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

    // Decrypt sensitive data to get the user's name
    let userName = "Unknown";
    if (userData.sensitiveData) {
      try {
        const decryptedData = decrypt(userData.sensitiveData);
        userName = decryptedData.name || "Unknown";
      } catch (decryptError) {
        console.error("Error decrypting user data:", decryptError);
      }
    }

    // Delete from Firebase Auth
    await admin.auth().deleteUser(userId);

    // Delete from Firestore
    await admin.firestore().collection("users").doc(userId).delete();

    // Add to action history
    await admin.firestore().collection("adminActions").add({
      userId,
      userName,
      action: "deleted",
      adminId: req.user.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log admin action
    logger.userAction(req.user.uid, "delete_user", {
      deletedUserId: userId,
      deletedUserName: userName,
      deletedUserRole: userData.role,
      requestId: req.requestId,
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error deleting user" });
  }
});

// Get user profile
router.get("/profile", verifyToken, verifyMfaIfEnabled, async (req, res) => {
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
    let userProfile = {
      id: userId,
      email: userData.email,
      role: userData.role,
      status: userData.status || "active",
    };

    // Decrypt sensitive data if present
    if (userData.sensitiveData) {
      userProfile = decryptUserData(userData.sensitiveData, userProfile);
    }

    // Calculate age from birthdate
    if (userProfile.birthdate) {
      const birthdate = new Date(userProfile.birthdate);
      const age = Math.floor(
        (new Date() - birthdate) / (365.25 * 24 * 60 * 60 * 1000)
      );
      userProfile.age = age;
    }

    // Log profile view
    logger.userAction(userId, "view_profile", {
      requestId: req.requestId,
    });

    // Return user profile data
    res.status(200).json(userProfile);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Error fetching user profile" });
  }
});

// Update user profile
router.put("/profile", verifyToken, verifyMfaIfEnabled, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { name, gender, birthdate } = req.body;

    logger.debug("Profile update request", {
      userId,
      hasName: !!name,
      hasGender: !!gender,
      hasBirthdate: !!birthdate,
      requestId: req.requestId,
    });

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

    // Try to decrypt existing data if available
    let existingData = {};
    if (userData.sensitiveData) {
      try {
        existingData = decrypt(userData.sensitiveData);
        logger.debug("Successfully decrypted existing data", {
          userId,
          requestId: req.requestId,
        });
      } catch (err) {
        logger.error("Error decrypting existing data", err, {
          userId,
          requestId: req.requestId,
        });
        // Continue with empty existing data
      }
    }

    // Update Firebase Auth display name
    try {
      const firebaseUser = await admin.auth().getUser(userId);
      if (firebaseUser.displayName !== name) {
        await admin.auth().updateUser(userId, { displayName: name });
        logger.debug("Updated Firebase Auth display name", {
          userId,
          requestId: req.requestId,
        });
      }
    } catch (authError) {
      logger.error("Error updating Firebase Auth user", authError, {
        userId,
        requestId: req.requestId,
      });
      // Continue even if Auth update fails
    }

    // Create new data to encrypt
    const newSensitiveData = {
      name,
      gender,
      birthdate,
      // Preserve any other sensitive fields
      ...existingData,
      // But ensure our new values take precedence
      name,
      gender,
      birthdate,
    };

    logger.debug("Preparing to encrypt updated data", {
      userId,
      requestId: req.requestId,
    });

    // Encrypt sensitive data
    const encryptedData = encrypt(newSensitiveData);

    // Update Firestore document
    await userRef.update({
      sensitiveData: encryptedData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Calculate age
    const birthDate = new Date(birthdate);
    const age = Math.floor(
      (new Date() - birthDate) / (365.25 * 24 * 60 * 60 * 1000)
    );

    logger.info("Profile updated successfully", {
      userId,
      requestId: req.requestId,
    });

    // Log profile update
    logger.userAction(userId, "update_profile", {
      requestId: req.requestId,
      fields: ["name", "gender", "birthdate"],
    });

    // Return updated profile for immediate UI refresh
    res.status(200).json({
      message: "Profile updated successfully",
      updatedProfile: {
        name,
        gender,
        birthdate,
        age,
      },
    });
  } catch (error) {
    logger.error("Error updating user profile", error, {
      userId: req.user?.uid,
      requestId: req.requestId,
    });
    res
      .status(500)
      .json({ message: "Error updating user profile", error: error.message });
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

      // Base patient data
      let patientInfo = {
        id: patientId,
        email: patientData.email,
        role: patientData.role,
      };

      // Decrypt sensitive data
      if (patientData.sensitiveData) {
        patientInfo = decryptUserData(patientData.sensitiveData, patientInfo);
      }

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

        // Decrypt health data if it's encrypted
        if (healthData.sensitiveData) {
          const decryptedSensitiveData = decrypt(healthData.sensitiveData);
          latestHealthData = {
            ...healthData,
            ...decryptedSensitiveData,
            timestamp: healthData.timestamp?.toDate(),
          };
          delete latestHealthData.sensitiveData;
        } else {
          latestHealthData = {
            ...healthData,
            timestamp: healthData.timestamp?.toDate(),
          };
        }

        // Decrypt prediction data if it exists
        if (healthData.prediction) {
          try {
            latestHealthData.prediction = decrypt(healthData.prediction);
          } catch (predictionError) {
            console.error("Error decrypting prediction data:", predictionError);
            // Keep original prediction data if decryption fails
          }
        }
      }

      patientInfo.latestHealthData = latestHealthData;
      patientsData.push(patientInfo);
    }

    // Log patients view
    logger.userAction(req.user.uid, "view_patients", {
      requestId: req.requestId,
      patientCount: patientsData.length,
    });

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

    // Decrypt sensitive data to get the user's name
    let userName = "Unknown";
    if (userData.sensitiveData) {
      try {
        const decryptedData = decrypt(userData.sensitiveData);
        userName = decryptedData.name || "Unknown";
      } catch (decryptError) {
        console.error("Error decrypting user data:", decryptError);
      }
    }

    // Add to action history
    await admin.firestore().collection("adminActions").add({
      userId,
      userName,
      action: "rejected",
      adminId: req.user.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log admin action
    logger.userAction(req.user.uid, "reject_doctor", {
      doctorId: userId,
      doctorName: userName,
      requestId: req.requestId,
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

    // Log admin action
    logger.userAction(req.user.uid, "view_action_history", {
      requestId: req.requestId,
      recordCount: history.length,
    });

    res.json(history);
  } catch (error) {
    console.error("Error fetching action history:", error);
    res.status(500).json({ message: "Error fetching action history" });
  }
});

module.exports = router;
