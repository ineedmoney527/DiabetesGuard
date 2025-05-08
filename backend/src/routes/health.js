const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { body, validationResult } = require("express-validator");
const fetch = require("node-fetch");
const { verifyToken, isDoctor } = require("../middleware/auth");
const { subDays, format, differenceInYears } = require("date-fns");
const { encrypt, decrypt } = require("../utils/encryption");
const { logger } = require("../utils/logger");

// Health data validation middleware
const healthDataValidation = [
  body("Pregnancies").isNumeric(),
  body("Glucose").isNumeric(),
  body("BloodPressure").isNumeric(),
  body("Insulin").isNumeric(),
  body("BMI").isNumeric(),
];

// Save health data
router.post("/data", verifyToken, healthDataValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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

    // Default to a reasonable age if calculation fails
    let age = 30;

    // Get sensitive user data including birthdate
    let userSensitiveData = {};
    if (userData.sensitiveData) {
      try {
        userSensitiveData = decrypt(userData.sensitiveData);
        logger.debug("Successfully decrypted user data for health submission", {
          userId,
          requestId: req.requestId,
        });

        // Calculate age from birthdate if available
        if (userSensitiveData.birthdate) {
          const birthdate = new Date(userSensitiveData.birthdate);
          age = Math.floor(
            (new Date() - birthdate) / (365.25 * 24 * 60 * 60 * 1000)
          );

          // Validate calculated age
          if (isNaN(age) || age < 0 || age > 120) {
            logger.warn("Invalid age calculated - using default age", {
              userId,
              calculatedAge: age,
              requestId: req.requestId,
            });
            age = 30; // Default to reasonable age
          }

          logger.debug("Calculated age for health data", {
            userId,
            age,
            requestId: req.requestId,
          });
        } else {
          logger.warn("No birthdate found in user data, using default age", {
            userId,
            requestId: req.requestId,
          });
        }
      } catch (error) {
        logger.error("Error decrypting user data for age calculation", error, {
          userId,
          requestId: req.requestId,
        });
        // Continue with default age
      }
    } else {
      logger.warn("No sensitive user data found, using default age", {
        userId,
        requestId: req.requestId,
      });
    }

    // Set pregnancies to 0 if user is male
    let pregnancies = req.body.Pregnancies;
    if (userSensitiveData.gender === "male") {
      pregnancies = 0;
    }

    const healthData = {
      Pregnancies: pregnancies,
      Glucose: req.body.Glucose,
      BloodPressure: req.body.BloodPressure,
      Insulin: req.body.Insulin,
      BMI: req.body.BMI,
      Age: age,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userId: userId,
    };

    // Create a record with encrypted sensitive data for storage
    const encryptedHealthData = {
      // Encrypt all sensitive health data as a single object
      sensitiveData: encrypt({
        Pregnancies: pregnancies,
        Glucose: req.body.Glucose,
        BloodPressure: req.body.BloodPressure,
        Insulin: req.body.Insulin,
        BMI: req.body.BMI,
      }),
      // Keep non-sensitive metadata unencrypted for querying
      Age: age,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userId: userId,
    };

    // Save to Firestore with encrypted data
    const healthRef = await admin
      .firestore()
      .collection("healthData")
      .add(encryptedHealthData);

    // Get prediction from ML model
    try {
      const mlApiUrl = process.env.ML_API_URL || "http://localhost:5000";

      // Ensure all fields are valid numbers before sending to ML model
      const validatedHealthData = {
        ...healthData,
        Pregnancies: Number(healthData.Pregnancies) || 0,
        Glucose: Number(healthData.Glucose) || 0,
        BloodPressure: Number(healthData.BloodPressure) || 0,
        Insulin: Number(healthData.Insulin) || 0,
        BMI: Number(healthData.BMI) || 0,
        Age: Number(healthData.Age) || 30, // Ensure age is a number
      };

      const response = await fetch(`${mlApiUrl}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validatedHealthData),
      });

      const prediction = await response.json();

      // Encrypt prediction result before storage
      const encryptedPrediction = encrypt(prediction);

      // Save encrypted prediction with health data
      await healthRef.update({ prediction: encryptedPrediction });

      // Log health data submission with prediction
      logger.userAction(userId, "submit_health_data", {
        requestId: req.requestId,
        healthId: healthRef.id,
        hasPrediction: true,
        predictionValue: prediction.prediction,
      });

      return res.status(201).json({
        message: "Health data saved successfully",
        healthId: healthRef.id,
        prediction: prediction, // Return unencrypted prediction to client
      });
    } catch (predictionError) {
      logger.error("Error getting prediction", predictionError, {
        userId,
        healthId: healthRef.id,
        requestId: req.requestId,
      });

      // Still save the health data even if prediction fails

      // Log health data submission without prediction
      logger.userAction(userId, "submit_health_data", {
        requestId: req.requestId,
        healthId: healthRef.id,
        hasPrediction: false,
        error: "Prediction failed",
      });

      return res.status(201).json({
        message: "Health data saved successfully, but prediction failed",
        healthId: healthRef.id,
        error: "Failed to get prediction",
      });
    }
  } catch (error) {
    logger.error("Error saving health data", error, {
      userId: req.user?.uid,
      requestId: req.requestId,
    });
    res.status(500).json({ message: "Error saving health data" });
  }
});

// Get patient's health data history
router.get("/data/history", verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;

    // Get optional date range filters
    const { startDate, endDate } = req.query;

    let query = admin
      .firestore()
      .collection("healthData")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc");

    if (startDate) {
      const startTimestamp = new Date(startDate);
      query = query.where("timestamp", ">=", startTimestamp);
    }

    if (endDate) {
      const endTimestamp = new Date(endDate);
      endTimestamp.setHours(23, 59, 59, 999); // End of the day
      query = query.where("timestamp", "<=", endTimestamp);
    }

    const snapshot = await query.get();

    const healthData = [];
    snapshot.forEach((doc) => {
      try {
        const data = doc.data();
        const decryptedData = {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate(),
        };

        // Decrypt sensitive data
        if (data.sensitiveData) {
          try {
            const decryptedSensitiveData = decrypt(data.sensitiveData);
            if (decryptedSensitiveData) {
              Object.assign(decryptedData, decryptedSensitiveData);
            }
            delete decryptedData.sensitiveData; // Remove the encrypted field
          } catch (decryptError) {
            logger.error(
              "Error decrypting sensitive health data",
              decryptError,
              {
                userId,
                healthId: doc.id,
                requestId: req.requestId,
              }
            );
            // Keep going, don't block the whole response for one failed item
          }
        }

        // Decrypt prediction if it exists
        if (data.prediction) {
          try {
            decryptedData.prediction = decrypt(data.prediction);
          } catch (predictionError) {
            logger.error("Error decrypting prediction data", predictionError, {
              userId,
              healthId: doc.id,
              requestId: req.requestId,
            });
            // Keep original prediction data
          }
        }

        healthData.push(decryptedData);
      } catch (itemError) {
        logger.error("Error processing health data item", itemError, {
          userId,
          docId: doc.id,
          requestId: req.requestId,
        });
        // Skip this item but continue processing others
      }
    });

    // Log health data history view
    logger.userAction(userId, "view_health_history", {
      requestId: req.requestId,
      recordCount: healthData.length,
      dateRange: {
        start: startDate || "all",
        end: endDate || "all",
      },
    });

    res.status(200).json(healthData);
  } catch (error) {
    console.error("Error fetching health data:", error);
    res.status(500).json({ message: "Error fetching health data" });
  }
});

// Get health data for doctor's patients
router.get(
  "/patients/:patientId?/data",
  verifyToken,
  isDoctor,
  async (req, res) => {
    try {
      const doctorId = req.user.uid;
      const { patientId } = req.params;

      // Get health data
      let query = admin.firestore().collection("healthData");

      if (patientId) {
        // Get data for specific patient
        query = query.where("userId", "==", patientId);
      } else {
        // Get data for all patients (removed doctor-patient mapping restriction)
        // No filter by doctor's patients - allow access to all patients
      }

      const snapshot = await query.orderBy("timestamp", "desc").get();

      const healthData = [];
      snapshot.forEach((doc) => {
        try {
          const data = doc.data();
          const decryptedData = {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate(),
          };

          // Decrypt sensitive data
          if (data.sensitiveData) {
            try {
              const decryptedSensitiveData = decrypt(data.sensitiveData);
              if (decryptedSensitiveData) {
                Object.assign(decryptedData, decryptedSensitiveData);
              }
              delete decryptedData.sensitiveData; // Remove the encrypted field
            } catch (decryptError) {
              console.error("Error decrypting sensitive data:", decryptError);
              // Keep going, don't block the whole response for one failed item
            }
          }

          // Decrypt prediction if it exists
          if (data.prediction) {
            try {
              decryptedData.prediction = decrypt(data.prediction);
            } catch (predictionError) {
              console.error("Error decrypting prediction:", predictionError);
              // Keep the original prediction data if decryption fails
            }
          }

          // Ensure Age is not null - provide default if needed
          if (decryptedData.Age === null || decryptedData.Age === undefined) {
            console.warn(
              `Record ${doc.id} has null Age, setting default value`
            );
            decryptedData.Age = 30; // Default age
          }

          healthData.push(decryptedData);
        } catch (itemError) {
          console.error("Error processing health data item:", itemError);
          // Continue processing other items
        }
      });

      // Log doctor viewing patient data
      logger.userAction(doctorId, "doctor_view_patient_data", {
        requestId: req.requestId,
        patientId: patientId || "all_patients",
        recordCount: healthData.length,
      });

      res.status(200).json(healthData);
    } catch (error) {
      console.error("Error fetching patient health data:", error);
      res.status(500).json({ message: "Error fetching patient health data" });
    }
  }
);

// Get aggregate stats for doctor's patients
router.get("/stats", verifyToken, isDoctor, async (req, res) => {
  try {
    // Get all patients with health data (removed doctor-patient mapping restriction)
    // Get all health records
    const healthSnapshot = await admin
      .firestore()
      .collection("healthData")
      .orderBy("timestamp", "desc")
      .get();

    // Extract unique patient IDs from health records
    const patientMap = new Map();

    healthSnapshot.forEach((doc) => {
      const data = doc.data();

      // Decrypt the sensitive health data
      let decryptedData = { ...data };

      if (data.sensitiveData) {
        try {
          const decryptedSensitiveData = decrypt(data.sensitiveData);
          decryptedData = {
            ...decryptedData,
            ...decryptedSensitiveData,
          };
        } catch (decryptErr) {
          console.error("Error decrypting sensitive health data:", decryptErr);
        }
      }

      // Decrypt prediction if it exists
      if (data.prediction) {
        try {
          decryptedData.prediction = decrypt(data.prediction);
        } catch (predictionErr) {
          console.error("Error decrypting prediction data:", predictionErr);
        }
      }

      if (data.userId && !patientMap.has(data.userId)) {
        patientMap.set(data.userId, {
          patientId: data.userId,
          ...decryptedData,
        });
      }
    });

    const latestRecords = Array.from(patientMap.values());
    const patientIds = Array.from(patientMap.keys());

    if (patientIds.length === 0) {
      return res.status(200).json({
        totalPatients: 0,
        riskDistribution: { low: 0, medium: 0, high: 0 },
        averageMetrics: {},
      });
    }

    // Calculate aggregate stats
    const riskDistribution = { low: 0, medium: 0, high: 0 };
    let totalGlucose = 0,
      totalBMI = 0,
      totalInsulin = 0,
      totalBloodPressure = 0;
    let count = 0;

    latestRecords.forEach((record) => {
      // Skip records without decrypted metrics
      if (
        typeof record.Glucose !== "number" ||
        typeof record.BMI !== "number" ||
        typeof record.Insulin !== "number" ||
        typeof record.BloodPressure !== "number"
      ) {
        console.warn(
          "Skipping record with missing metrics for patient:",
          record.patientId
        );
        return;
      }

      count++;
      totalGlucose += record.Glucose || 0;
      totalBMI += record.BMI || 0;
      totalInsulin += record.Insulin || 0;
      totalBloodPressure += record.BloodPressure || 0;

      // Count risk levels
      if (record.prediction && record.prediction.risk_level) {
        const risk = record.prediction.risk_level.toLowerCase();
        if (risk.includes("low")) {
          riskDistribution.low++;
        } else if (risk.includes("medium")) {
          riskDistribution.medium++;
        } else if (risk.includes("high")) {
          riskDistribution.high++;
        }
      }
    });

    const averageMetrics =
      count > 0
        ? {
            glucose: totalGlucose / count,
            bmi: totalBMI / count,
            insulin: totalInsulin / count,
            bloodPressure: totalBloodPressure / count,
          }
        : {};

    res.status(200).json({
      totalPatients: patientIds.length,
      patientsWithData: count,
      riskDistribution,
      averageMetrics,
    });
  } catch (error) {
    console.error("Error calculating aggregate stats:", error);
    res.status(500).json({ message: "Error calculating aggregate stats" });
  }
});

// Get aggregate health trends data
router.get("/aggregate/trends", verifyToken, isDoctor, async (req, res) => {
  try {
    const { startDate, endDate, ageGroup, gender, position } = req.query;

    // Parse date range
    const start = new Date(startDate || subDays(new Date(), 30));
    const end = new Date(endDate || new Date());

    // Convert to Firestore timestamps
    const startTimestamp = admin.firestore.Timestamp.fromDate(start);
    const endTimestamp = admin.firestore.Timestamp.fromDate(end);

    // Get all health data within date range
    const healthDataSnapshot = await admin
      .firestore()
      .collection("healthData")
      .where("timestamp", ">=", startTimestamp)
      .where("timestamp", "<=", endTimestamp)
      .orderBy("timestamp", "asc")
      .get();

    if (healthDataSnapshot.empty) {
      return res.status(200).json([]);
    }

    // Create a map to store unique user IDs for filtering
    const userIds = new Set();
    healthDataSnapshot.docs.forEach((doc) => {
      userIds.add(doc.data().userId);
    });

    // Get user details for filtering
    const usersSnapshot = await admin
      .firestore()
      .collection("users")
      .where("role", "==", "employee")
      .get();

    // Filter users based on criteria
    const filteredUserIds = new Set();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Skip if not in the original health data set
      if (!userIds.has(userId)) continue;

      // Decrypt user sensitive data to access gender, birthdate, etc.
      let decryptedUserData = { ...userData };
      if (userData.sensitiveData) {
        try {
          const decryptedData = decrypt(userData.sensitiveData);
          decryptedUserData = {
            ...decryptedUserData,
            ...decryptedData,
          };
        } catch (decryptErr) {
          console.error(
            "Error decrypting user data for filtering:",
            decryptErr
          );
          continue; // Skip this user if we can't decrypt their data
        }
      }

      // Filter by gender if specified
      if (gender && gender !== "all" && decryptedUserData.gender !== gender)
        continue;

      // Filter by position if specified
      if (
        position &&
        position !== "all" &&
        decryptedUserData.position !== position
      )
        continue;

      // Filter by age group if specified
      if (ageGroup && ageGroup !== "all") {
        if (!decryptedUserData.birthdate) {
          console.warn("No birthdate available for user:", userId);
          continue;
        }

        const birthDate = new Date(decryptedUserData.birthdate);
        const ageInYears = differenceInYears(new Date(), birthDate);

        if (ageGroup === "under30" && ageInYears >= 30) continue;
        if (ageGroup === "30to50" && (ageInYears < 30 || ageInYears > 50))
          continue;
        if (ageGroup === "over50" && ageInYears <= 50) continue;
      }

      // If all filters pass, add to filtered set
      filteredUserIds.add(userId);
    }

    // Aggregate data by date (month/year)
    const aggregateByDate = {};

    for (const doc of healthDataSnapshot.docs) {
      const data = doc.data();

      // Skip if user doesn't match filters
      if (!filteredUserIds.has(data.userId)) continue;

      // Decrypt health data metrics
      let decryptedHealthData = { ...data };
      if (data.sensitiveData) {
        try {
          const decryptedSensitiveData = decrypt(data.sensitiveData);
          decryptedHealthData = {
            ...decryptedHealthData,
            ...decryptedSensitiveData,
          };
        } catch (decryptErr) {
          console.error("Error decrypting health metrics:", decryptErr);
          continue; // Skip this record if we can't decrypt the data
        }
      }

      const date = data.timestamp.toDate();
      const dateKey = format(date, "yyyy-MM-dd");

      if (!aggregateByDate[dateKey]) {
        aggregateByDate[dateKey] = {
          date: dateKey,
          count: 0,
          Glucose: 0,
          BMI: 0,
          Insulin: 0,
          BloodPressure: 0,
        };
      }

      // Make sure we have valid numbers for the health metrics
      if (
        typeof decryptedHealthData.Glucose !== "number" ||
        typeof decryptedHealthData.BMI !== "number" ||
        typeof decryptedHealthData.Insulin !== "number" ||
        typeof decryptedHealthData.BloodPressure !== "number"
      ) {
        console.warn(
          "Skipping record with invalid metrics for user:",
          data.userId
        );
        continue;
      }

      aggregateByDate[dateKey].count += 1;
      aggregateByDate[dateKey].Glucose += decryptedHealthData.Glucose || 0;
      aggregateByDate[dateKey].BMI += decryptedHealthData.BMI || 0;
      aggregateByDate[dateKey].Insulin += decryptedHealthData.Insulin || 0;
      aggregateByDate[dateKey].BloodPressure +=
        decryptedHealthData.BloodPressure || 0;
    }

    // Calculate averages
    const aggregateTrends = Object.values(aggregateByDate).map((item) => {
      return {
        date: item.date,
        Glucose: Math.round((item.Glucose / item.count) * 10) / 10,
        BMI: Math.round((item.BMI / item.count) * 10) / 10,
        Insulin: Math.round((item.Insulin / item.count) * 10) / 10,
        BloodPressure: Math.round((item.BloodPressure / item.count) * 10) / 10,
        count: item.count,
      };
    });

    // Sort by date
    aggregateTrends.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json(aggregateTrends);
  } catch (error) {
    console.error("Error calculating aggregate trends:", error);
    res.status(500).json({ message: "Error calculating aggregate trends" });
  }
});

// Get aggregate risk trends data
router.get("/aggregate/risk", verifyToken, isDoctor, async (req, res) => {
  try {
    const { startDate, endDate, ageGroup, gender, position } = req.query;

    // Parse date range
    const start = new Date(startDate || subDays(new Date(), 30));
    const end = new Date(endDate || new Date());

    // Convert to Firestore timestamps
    const startTimestamp = admin.firestore.Timestamp.fromDate(start);
    const endTimestamp = admin.firestore.Timestamp.fromDate(end);

    // Get all health data within date range
    const healthDataSnapshot = await admin
      .firestore()
      .collection("healthData")
      .where("timestamp", ">=", startTimestamp)
      .where("timestamp", "<=", endTimestamp)
      .orderBy("timestamp", "asc")
      .get();

    if (healthDataSnapshot.empty) {
      return res.status(200).json([]);
    }

    // Create a map to store unique user IDs for filtering
    const userIds = new Set();
    healthDataSnapshot.docs.forEach((doc) => {
      userIds.add(doc.data().userId);
    });

    // Get user details for filtering
    const usersSnapshot = await admin
      .firestore()
      .collection("users")
      .where("role", "==", "employee")
      .get();

    // Filter users based on criteria
    const filteredUserIds = new Set();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Skip if not in the original health data set
      if (!userIds.has(userId)) continue;

      // Decrypt user sensitive data to access gender, birthdate, etc.
      let decryptedUserData = { ...userData };
      if (userData.sensitiveData) {
        try {
          const decryptedData = decrypt(userData.sensitiveData);
          decryptedUserData = {
            ...decryptedUserData,
            ...decryptedData,
          };
        } catch (decryptErr) {
          console.error(
            "Error decrypting user data for filtering:",
            decryptErr
          );
          continue; // Skip this user if we can't decrypt their data
        }
      }

      // Filter by gender if specified
      if (gender && gender !== "all" && decryptedUserData.gender !== gender)
        continue;

      // Filter by position if specified
      if (
        position &&
        position !== "all" &&
        decryptedUserData.position !== position
      )
        continue;

      // Filter by age group if specified
      if (ageGroup && ageGroup !== "all") {
        if (!decryptedUserData.birthdate) {
          console.warn("No birthdate available for user:", userId);
          continue;
        }

        const birthDate = new Date(decryptedUserData.birthdate);
        const ageInYears = differenceInYears(new Date(), birthDate);

        if (ageGroup === "under30" && ageInYears >= 30) continue;
        if (ageGroup === "30to50" && (ageInYears < 30 || ageInYears > 50))
          continue;
        if (ageGroup === "over50" && ageInYears <= 50) continue;
      }

      // If all filters pass, add to filtered set
      filteredUserIds.add(userId);
    }

    // Aggregate risk data by date
    const aggregateByDate = {};

    for (const doc of healthDataSnapshot.docs) {
      const data = doc.data();

      // Skip if user doesn't match filters
      if (!filteredUserIds.has(data.userId)) continue;

      const date = data.timestamp.toDate();
      const dateKey = format(date, "yyyy-MM-dd");

      if (!aggregateByDate[dateKey]) {
        aggregateByDate[dateKey] = {
          date: dateKey,
          totalPatients: 0,
          lowRisk: 0,
          mediumRisk: 0,
          highRisk: 0,
          avgProbability: 0,
          totalProbability: 0,
        };
      }

      // Decrypt prediction data
      let predictionData = null;
      if (data.prediction) {
        try {
          predictionData = decrypt(data.prediction);
        } catch (decryptErr) {
          console.error("Error decrypting prediction data:", decryptErr);
          // Continue without prediction data
        }
      }

      aggregateByDate[dateKey].totalPatients++;

      // Process prediction data if available
      if (
        predictionData &&
        predictionData.risk_level &&
        predictionData.probability
      ) {
        const riskLevel = predictionData.risk_level.toLowerCase();
        const probability = parseFloat(predictionData.probability);

        if (!isNaN(probability)) {
          aggregateByDate[dateKey].totalProbability += probability;
        }

        if (riskLevel.includes("low")) {
          aggregateByDate[dateKey].lowRisk++;
        } else if (riskLevel.includes("medium")) {
          aggregateByDate[dateKey].mediumRisk++;
        } else if (riskLevel.includes("high")) {
          aggregateByDate[dateKey].highRisk++;
        }
      }
    }

    // Calculate percentages and averages
    const aggregateRiskTrends = Object.values(aggregateByDate).map((item) => {
      const total = item.totalPatients;
      return {
        date: item.date,
        totalPatients: total,
        lowRiskPercent:
          total > 0 ? Math.round((item.lowRisk / total) * 100) : 0,
        mediumRiskPercent:
          total > 0 ? Math.round((item.mediumRisk / total) * 100) : 0,
        highRiskPercent:
          total > 0 ? Math.round((item.highRisk / total) * 100) : 0,
        avgProbability:
          total > 0
            ? Math.round((item.totalProbability / total) * 100) / 100
            : 0,
      };
    });

    // Sort by date
    aggregateRiskTrends.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json(aggregateRiskTrends);
  } catch (error) {
    console.error("Error calculating aggregate risk trends:", error);
    res
      .status(500)
      .json({ message: "Error calculating aggregate risk trends" });
  }
});

// Helper function to encrypt prescription data
const encryptPrescriptionData = (prescriptionData) => {
  const sensitiveData = {
    medicines: prescriptionData.medicines,
    suggestion: prescriptionData.suggestion || "",
  };

  return encrypt(sensitiveData);
};

// Helper function to decrypt prescription data
const decryptPrescriptionData = (encryptedData, baseData) => {
  try {
    if (!encryptedData) return baseData;

    const decryptedData = decrypt(encryptedData);
    return { ...baseData, ...decryptedData };
  } catch (error) {
    logger.error("Error decrypting prescription data", error);
    return baseData;
  }
};

// Get prescriptions for a patient
router.get("/prescriptions", verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    logger.debug("Fetching prescriptions for user", {
      userId,
      requestId: req.requestId,
    });

    // Get optional date range filters
    const { startDate, endDate } = req.query;
    logger.debug("Date range for prescription query", {
      startDate,
      endDate,
      userId,
      requestId: req.requestId,
    });

    // Build the base query
    let query = admin
      .firestore()
      .collection("prescriptions")
      .where("patientId", "==", userId);

    // We'll handle date filtering in JavaScript instead of Firestore
    // because of potential timezone issues with timestamps
    const snapshot = await query.orderBy("timestamp", "desc").get();

    const prescriptions = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : null;

      // Only add if within date range (if specified)
      let includeRecord = true;

      if (startDate && timestamp) {
        const startTimestamp = new Date(startDate);
        if (timestamp < startTimestamp) {
          includeRecord = false;
        }
      }

      if (endDate && timestamp) {
        const endTimestamp = new Date(endDate);
        endTimestamp.setHours(23, 59, 59, 999); // End of the day
        if (timestamp > endTimestamp) {
          includeRecord = false;
        }
      }

      if (includeRecord) {
        let prescriptionData = {
          id: doc.id,
          ...data,
          timestamp: timestamp,
        };

        // Decrypt sensitive data if present
        if (data.sensitiveData) {
          prescriptionData = decryptPrescriptionData(
            data.sensitiveData,
            prescriptionData
          );
          delete prescriptionData.sensitiveData;
        }

        prescriptions.push(prescriptionData);
      }
    });

    logger.debug("Prescriptions retrieved", {
      userId,
      count: prescriptions.length,
      requestId: req.requestId,
    });
    res.status(200).json(prescriptions);
  } catch (error) {
    logger.error("Error fetching prescriptions", error, {
      userId: req.user?.uid,
      requestId: req.requestId,
    });
    res.status(500).json({ message: "Error fetching prescriptions" });
  }
});

// Get prescriptions for a specific patient (doctor view)
router.get(
  "/patients/:patientId/prescriptions",
  verifyToken,
  isDoctor,
  async (req, res) => {
    try {
      const patientId = req.params.patientId;
      logger.debug("Doctor fetching prescriptions for patient", {
        doctorId: req.user.uid,
        patientId,
        requestId: req.requestId,
      });

      const snapshot = await admin
        .firestore()
        .collection("prescriptions")
        .where("patientId", "==", patientId)
        .orderBy("timestamp", "desc")
        .get();

      const prescriptions = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        let prescriptionData = {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : null,
        };

        // Decrypt sensitive data if present
        if (data.sensitiveData) {
          prescriptionData = decryptPrescriptionData(
            data.sensitiveData,
            prescriptionData
          );
          delete prescriptionData.sensitiveData;
        }

        prescriptions.push(prescriptionData);
      });

      logger.debug("Prescriptions retrieved for patient", {
        doctorId: req.user.uid,
        patientId,
        count: prescriptions.length,
        requestId: req.requestId,
      });
      res.status(200).json(prescriptions);
    } catch (error) {
      logger.error("Error fetching patient prescriptions", error, {
        doctorId: req.user?.uid,
        patientId: req.params.patientId,
        requestId: req.requestId,
      });
      res.status(500).json({ message: "Error fetching patient prescriptions" });
    }
  }
);

// Add prescription for a patient
router.post(
  "/patients/:patientId/prescription",
  verifyToken,
  isDoctor,
  [
    body("medicines").isArray(),
    body("medicines.*.name").isString().notEmpty(),
    body("medicines.*.dosage").isString().notEmpty(),
    body("medicines.*.frequency").isString().notEmpty(),
    body("medicines.*.duration").isString().notEmpty(),
    body("medicines.*.specialInstructions").isString().optional(),
    body("suggestion").isString().optional(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn("Prescription validation errors", {
          doctorId: req.user.uid,
          errors: errors.array(),
          requestId: req.requestId,
        });
        return res.status(400).json({ errors: errors.array() });
      }

      const doctorId = req.user.uid;
      const patientId = req.params.patientId;

      logger.debug("Creating prescription", {
        doctorId,
        patientId,
        medicineCount: req.body.medicines.length,
        hasSuggestion: !!req.body.suggestion,
        requestId: req.requestId,
      });

      // Get doctor info for the prescription
      const doctorDoc = await admin
        .firestore()
        .collection("users")
        .doc(doctorId)
        .get();

      if (!doctorDoc.exists) {
        logger.error("Doctor not found when creating prescription", {
          doctorId,
          patientId,
          requestId: req.requestId,
        });
        return res.status(404).json({ message: "Doctor not found" });
      }

      const doctorData = doctorDoc.data();

      // Get doctor name from encrypted data if present
      let doctorName = "Doctor";
      if (doctorData.sensitiveData) {
        try {
          const decryptedData = decrypt(doctorData.sensitiveData);
          doctorName = decryptedData.name || doctorName;
        } catch (error) {
          logger.error("Error getting doctor name for prescription", error, {
            doctorId,
            requestId: req.requestId,
          });
        }
      } else if (doctorData.name) {
        doctorName = doctorData.name;
      }

      // Verify patient exists
      const patientDoc = await admin
        .firestore()
        .collection("users")
        .doc(patientId)
        .get();

      if (!patientDoc.exists) {
        logger.error("Patient not found when creating prescription", {
          doctorId,
          patientId,
          requestId: req.requestId,
        });
        return res.status(404).json({ message: "Patient not found" });
      }

      // Encrypt sensitive prescription data
      const sensitiveData = encryptPrescriptionData({
        medicines: req.body.medicines,
        suggestion: req.body.suggestion || "",
      });

      const prescription = {
        doctorId,
        doctorName,
        patientId,
        sensitiveData,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      };

      logger.debug("Saving prescription to Firestore", {
        doctorId,
        patientId,
        requestId: req.requestId,
      });

      // Save prescription to Firestore
      const prescriptionRef = await admin
        .firestore()
        .collection("prescriptions")
        .add(prescription);

      logger.info("Prescription saved successfully", {
        doctorId,
        patientId,
        prescriptionId: prescriptionRef.id,
        requestId: req.requestId,
      });

      // Log prescription creation
      logger.userAction(doctorId, "create_prescription", {
        patientId,
        prescriptionId: prescriptionRef.id,
        medicineCount: req.body.medicines.length,
        requestId: req.requestId,
      });

      return res.status(201).json({
        message: "Prescription added successfully",
        prescriptionId: prescriptionRef.id,
      });
    } catch (error) {
      logger.error("Error adding prescription", error, {
        doctorId: req.user?.uid,
        patientId: req.params.patientId,
        requestId: req.requestId,
      });
      res.status(500).json({ message: "Error adding prescription" });
    }
  }
);

module.exports = router;
