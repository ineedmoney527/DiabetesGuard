require("dotenv").config();
const admin = require("firebase-admin");
const { faker } = require("@faker-js/faker");
const { encrypt } = require("./src/utils/encryption");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });
}

const firestore = admin.firestore();

// Generate a random number between min and max
const randomNumber = (min, max) =>
  Math.floor(Math.random() * (max - min + 1) + min);

// Generate a random date between 2 dates
const randomDate = (start, end) => {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
};

// Create dummy users
const createUsers = async () => {
  const userIds = [];
  const roles = ["employee", "doctor", "admin"];
  const genders = ["male", "female"];
  const positions = [
    "driver",
    "cook",
    "chef",
    "kitchen_helper",
    "truck_driver",
    "baker",
    "food_tester",
  ];

  console.log("Creating 10 dummy users...");

  for (let i = 0; i < 15; i++) {
    const role = i < 13 ? roles[0] : i < 14 ? roles[1] : roles[2]; // 7 employees, 2 doctors, 1 admin
    const gender = genders[Math.floor(Math.random() * genders.length)];
    const firstName = faker.person.firstName(
      gender === "male" ? "male" : "female"
    );
    const lastName = faker.person.lastName();
    const name = `${firstName} ${lastName}`;
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();

    // Generate birthdate between 25 and 65 years ago
    const now = new Date();
    const birthdate = randomDate(
      new Date(now.getFullYear() - 65, 0, 1),
      new Date(now.getFullYear() - 25, 11, 31)
    )
      .toISOString()
      .split("T")[0]; // Format as YYYY-MM-DD

    // Encrypt sensitive user data
    const sensitiveData = encrypt({
      name,
      gender,
      birthdate,
      position:
        role === "employee"
          ? positions[Math.floor(Math.random() * positions.length)]
          : null,
      phone: faker.phone.number(),
      address: faker.location.streetAddress(),
    });

    const status =
      role === "doctor"
        ? Math.random() > 0.7
          ? "inactive"
          : "active"
        : "active";

    // Create user document
    const userRef = firestore.collection("users").doc();
    await userRef.set({
      email,
      role,
      status,
      sensitiveData,
      mfaEnabled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Created user: ${email} (${role})`);
    userIds.push(userRef.id);
  }

  return userIds;
};

// Create health data for employee users
const createHealthData = async (userIds) => {
  console.log("\nCreating health data for employee users...");

  // Get only employee users
  const employeeSnapshot = await firestore
    .collection("users")
    .where("role", "==", "employee")
    .get();

  const employeeIds = [];
  employeeSnapshot.forEach((doc) => {
    employeeIds.push(doc.id);
  });

  // Create 2-5 health records for each employee
  for (const userId of employeeIds) {
    const recordCount = randomNumber(2, 5);
    console.log(`Creating ${recordCount} health records for user ${userId}`);

    for (let i = 0; i < recordCount; i++) {
      // Get user data to calculate age
      const userDoc = await firestore.collection("users").doc(userId).get();
      const userData = userDoc.data();

      let age = 30; // Default age
      let pregnancies = 0; // Default pregnancies

      // Calculate age if we can get birthdate
      if (userData.sensitiveData) {
        try {
          const decryptedData = require("./src/utils/encryption").decrypt(
            userData.sensitiveData
          );
          if (decryptedData.birthdate) {
            const birthdate = new Date(decryptedData.birthdate);
            age = Math.floor(
              (new Date() - birthdate) / (365.25 * 24 * 60 * 60 * 1000)
            );
          }

          // Generate random health metrics based on gender
          pregnancies =
            decryptedData.gender === "male" ? 0 : randomNumber(0, 5);
        } catch (error) {
          console.error(`Failed to decrypt user data for ${userId}:`, error);
        }
      }

      // Generate random health metrics
      const glucose = randomNumber(70, 200);
      const bloodPressure = randomNumber(60, 140);
      const insulin = randomNumber(0, 200);
      const bmi = parseFloat((randomNumber(18, 35) + Math.random()).toFixed(1));

      // Create timestamp for the record (from 1 month ago to today)
      const now = new Date();
      const oneMonthAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        now.getDate()
      );
      const recordDate = randomDate(oneMonthAgo, now);

      // Encrypt sensitive health data
      const sensitiveData = encrypt({
        Pregnancies: pregnancies,
        Glucose: glucose,
        BloodPressure: bloodPressure,
        Insulin: insulin,
        BMI: bmi,
      });

      // Create health record
      const healthRef = firestore.collection("healthData").doc();
      await healthRef.set({
        sensitiveData,
        Age: age,
        userId: userId,
        timestamp: recordDate,
      });

      // Generate prediction
      let prediction = {};
      try {
        const mlFeatures = [
          pregnancies,
          glucose,
          bloodPressure,
          insulin,
          bmi,
          age,
        ];
        // Simple rule-based "prediction" instead of actual ML model
        const probability =
          (glucose > 140 ? 0.3 : 0) +
          (bmi > 30 ? 0.3 : 0) +
          (age > 50 ? 0.2 : 0) +
          (insulin > 150 ? 0.2 : 0);

        let riskLevel = "Low Risk";
        if (probability >= 0.7) {
          riskLevel = "High Risk";
        } else if (probability >= 0.4) {
          riskLevel = "Medium Risk";
        }

        prediction = {
          prediction: probability >= 0.5 ? 1 : 0,
          probability: probability,
          risk_level: riskLevel,
        };

        // Encrypt prediction
        const encryptedPrediction = encrypt(prediction);
        await healthRef.update({ prediction: encryptedPrediction });
      } catch (error) {
        console.error(`Error creating prediction for health record:`, error);
        await healthRef.update({
          prediction: encrypt({
            error: "Failed to generate prediction in seed data",
          }),
        });
      }

      console.log(
        `  Created health record with risk level: ${
          prediction.risk_level || "Unknown"
        }`
      );
    }
  }
};

// Create prescriptions
const createPrescriptions = async () => {
  console.log("\nCreating prescriptions...");

  // Get doctor and employee IDs
  const doctorSnapshot = await firestore
    .collection("users")
    .where("role", "==", "doctor")
    .where("status", "==", "active")
    .get();

  if (doctorSnapshot.empty) {
    console.log("No active doctors found. Skipping prescriptions.");
    return;
  }

  const doctorIds = [];
  const doctorData = {};

  doctorSnapshot.forEach((doc) => {
    doctorIds.push(doc.id);
    doctorData[doc.id] = doc.data();
  });

  const employeeSnapshot = await firestore
    .collection("users")
    .where("role", "==", "employee")
    .get();

  const employeeIds = [];
  employeeSnapshot.forEach((doc) => {
    employeeIds.push(doc.id);
  });

  // Create 1-3 prescriptions for each employee
  for (const employeeId of employeeIds) {
    const prescriptionCount = randomNumber(1, 3);
    console.log(
      `Creating ${prescriptionCount} prescriptions for employee ${employeeId}`
    );

    for (let i = 0; i < prescriptionCount; i++) {
      // Choose a random doctor
      const doctorId = doctorIds[Math.floor(Math.random() * doctorIds.length)];

      // Get doctor name from encrypted data
      let doctorName = "Doctor";
      try {
        const doctorEncryptedData = doctorData[doctorId].sensitiveData;
        const decryptedData = require("./src/utils/encryption").decrypt(
          doctorEncryptedData
        );
        doctorName = decryptedData.name || doctorName;
      } catch (error) {
        console.error(`Error decrypting doctor data:`, error);
      }

      // Generate prescription data
      const medicines = [];
      const medicineCount = randomNumber(1, 3);

      for (let j = 0; j < medicineCount; j++) {
        medicines.push({
          name: faker.helpers.arrayElement([
            "Metformin",
            "Gliclazide",
            "Insulin Glargine",
            "Sitagliptin",
            "Empagliflozin",
            "Liraglutide",
          ]),
          dosage: faker.helpers.arrayElement([
            "500mg",
            "1000mg",
            "850mg",
            "100mg",
            "25mg",
            "10 units",
          ]),
          frequency: faker.helpers.arrayElement([
            "Once daily",
            "Twice daily",
            "Three times daily",
            "With meals",
            "Before breakfast",
            "At bedtime",
          ]),
          duration: faker.helpers.arrayElement([
            "1 month",
            "3 months",
            "6 months",
            "Ongoing",
            "2 weeks",
          ]),
          specialInstructions:
            Math.random() > 0.5
              ? faker.helpers.arrayElement([
                  "Take with food",
                  "Avoid alcohol",
                  "Monitor blood sugar levels",
                  "Take 30 minutes before meals",
                  "Do not discontinue abruptly",
                ])
              : "",
        });
      }

      // Generate suggestion
      const suggestion =
        Math.random() > 0.3
          ? faker.helpers.arrayElement([
              "Maintain a low-carb diet and exercise regularly.",
              "Monitor blood glucose levels daily and keep a log.",
              "Reduce sugar intake and increase physical activity.",
              "Schedule a follow-up appointment in 3 months.",
              "Consider joining a diabetes support group.",
            ])
          : "";

      // Encrypt sensitive prescription data
      const sensitiveData = encrypt({
        medicines,
        suggestion,
      });

      // Create timestamp for the prescription (from 2 months ago to today)
      const now = new Date();
      const twoMonthsAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 2,
        now.getDate()
      );
      const prescriptionDate = randomDate(twoMonthsAgo, now);

      // Create prescription record
      const prescriptionRef = firestore.collection("prescriptions").doc();
      await prescriptionRef.set({
        doctorId,
        doctorName,
        patientId: employeeId,
        sensitiveData,
        timestamp: prescriptionDate,
      });

      console.log(`  Created prescription from Dr. ${doctorName}`);
    }
  }
};

// Main function to seed the database
const seedDatabase = async () => {
  try {
    console.log("Starting database seeding...");

    // Create users
    const userIds = await createUsers();

    // Create health data
    await createHealthData(userIds);

    // Create prescriptions
    await createPrescriptions();

    console.log("\nDatabase seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    // Exit the process
    process.exit(0);
  }
};

// Run the seeding
seedDatabase();
