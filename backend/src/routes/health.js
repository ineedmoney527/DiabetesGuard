const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { body, validationResult } = require("express-validator");
const fetch = require("node-fetch");
const { verifyToken, isDoctor } = require("../middleware/auth");
const { subDays, format, differenceInYears } = require("date-fns");

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

    // Calculate age from birthdate
    const birthdate = new Date(userData.birthdate);
    const age = Math.floor(
      (new Date() - birthdate) / (365.25 * 24 * 60 * 60 * 1000)
    );

    // Set pregnancies to 0 if user is male
    let pregnancies = req.body.Pregnancies;
    if (userData.gender === "male") {
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

    // Save to Firestore
    const healthRef = await admin
      .firestore()
      .collection("healthData")
      .add(healthData);

    // Get prediction from ML model
    try {
      const mlApiUrl = process.env.ML_API_URL || "http://localhost:5000";
      const response = await fetch(`${mlApiUrl}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(healthData),
      });

      console.log("Response for preedicton:", response);

      const prediction = await response.json();

      // Save prediction with health data
      await healthRef.update({ prediction: prediction });

      return res.status(201).json({
        message: "Health data saved successfully",
        healthId: healthRef.id,
        prediction: prediction,
      });
    } catch (predictionError) {
      console.error("Error getting prediction:", predictionError);

      // Still save the health data even if prediction fails
      return res.status(201).json({
        message: "Health data saved successfully, but prediction failed",
        healthId: healthRef.id,
        error: "Failed to get prediction",
      });
    }
  } catch (error) {
    console.error("Error saving health data:", error);
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
      healthData.push({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
      });
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
        healthData.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate(),
        });
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
      if (data.userId && !patientMap.has(data.userId)) {
        patientMap.set(data.userId, {
          patientId: data.userId,
          ...data,
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
      count++;
      totalGlucose += record.Glucose;
      totalBMI += record.BMI;
      totalInsulin += record.Insulin;
      totalBloodPressure += record.BloodPressure;

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

      // Filter by gender if specified
      if (gender && gender !== "all" && userData.gender !== gender) continue;

      // Filter by position if specified
      if (position && position !== "all" && userData.position !== position)
        continue;

      // Filter by age group if specified
      if (ageGroup && ageGroup !== "all") {
        const birthDate = new Date(userData.birthdate);
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

      aggregateByDate[dateKey].count += 1;
      aggregateByDate[dateKey].Glucose += data.Glucose;
      aggregateByDate[dateKey].BMI += data.BMI;
      aggregateByDate[dateKey].Insulin += data.Insulin;
      aggregateByDate[dateKey].BloodPressure += data.BloodPressure;
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
    console.error("Error fetching aggregate health trends:", error);
    res.status(500).json({ message: "Error fetching aggregate health trends" });
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

      // Filter by gender if specified
      if (gender && gender !== "all" && userData.gender !== gender) continue;

      // Filter by position if specified
      if (position && position !== "all" && userData.position !== position)
        continue;

      // Filter by age group if specified
      if (ageGroup && ageGroup !== "all") {
        const birthDate = new Date(userData.birthdate);
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

      // Skip if user doesn't match filters or no prediction data
      if (!filteredUserIds.has(data.userId) || !data.prediction) continue;

      const date = data.timestamp.toDate();
      const dateKey = format(date, "yyyy-MM-dd");

      if (!aggregateByDate[dateKey]) {
        aggregateByDate[dateKey] = {
          date: dateKey,
          count: 0,
          lowRisk: 0,
          mediumRisk: 0,
          highRisk: 0,
          averageProbability: 0,
        };
      }

      aggregateByDate[dateKey].count += 1;
      aggregateByDate[dateKey].averageProbability +=
        data.prediction.probability;

      // Count by risk level
      if (data.prediction.risk_level === "Low Risk") {
        aggregateByDate[dateKey].lowRisk += 1;
      } else if (data.prediction.risk_level === "Medium Risk") {
        aggregateByDate[dateKey].mediumRisk += 1;
      } else if (data.prediction.risk_level === "High Risk") {
        aggregateByDate[dateKey].highRisk += 1;
      }
    }

    // Calculate percentages and averages
    const aggregateRiskTrends = Object.values(aggregateByDate).map((item) => {
      const totalCount = item.count || 1; // Avoid division by zero

      return {
        date: item.date,
        lowRiskPercent: Math.round((item.lowRisk / totalCount) * 100),
        mediumRiskPercent: Math.round((item.mediumRisk / totalCount) * 100),
        highRiskPercent: Math.round((item.highRisk / totalCount) * 100),
        averageProbability:
          Math.round((item.averageProbability / totalCount) * 100) / 100,
        count: item.count,
      };
    });

    // Sort by date
    aggregateRiskTrends.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json(aggregateRiskTrends);
  } catch (error) {
    console.error("Error fetching aggregate risk trends:", error);
    res.status(500).json({ message: "Error fetching aggregate risk trends" });
  }
});

module.exports = router;
