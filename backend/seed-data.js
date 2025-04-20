const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const { faker } = require("@faker-js/faker");
const { v4: uuidv4 } = require("uuid");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Number of dummy patients to create
const NUM_EMPLOYEES = 25;
// Number of health records per patient (random between 3-10)
const MIN_RECORDS = 3;
const MAX_RECORDS = 10;

// List of possible positions
const POSITIONS = [
  "driver",
  "cook",
  "chef",
  "kitchen_helper",
  "truck_driver",
  "baker",
  "food_tester",
];

async function seedDatabase() {
  console.log("Starting to seed database...");

  try {
    const userPromises = [];
    const healthPromises = [];

    for (let i = 0; i < NUM_EMPLOYEES; i++) {
      const userId = uuidv4();
      const gender = faker.helpers.arrayElement(["male", "female"]);
      const birthYear = faker.number.int({ min: 1960, max: 2000 });
      const birthMonth = faker.number.int({ min: 1, max: 12 });
      const birthDay = faker.number.int({ min: 1, max: 28 });
      const birthdate = `${birthYear}-${birthMonth
        .toString()
        .padStart(2, "0")}-${birthDay.toString().padStart(2, "0")}`;
      const age = new Date().getFullYear() - birthYear;
      const position = faker.helpers.arrayElement(POSITIONS);

      const user = {
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        gender,
        birthdate,
        role: "employee",
        position,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      userPromises.push(db.collection("users").doc(userId).set(user));

      const numRecords = faker.number.int({
        min: MIN_RECORDS,
        max: MAX_RECORDS,
      });

      for (let j = 0; j < numRecords; j++) {
        const pregnancies =
          gender === "female" ? faker.number.int({ min: 0, max: 5 }) : 0;
        const glucose = faker.number.int({ min: 70, max: 200 });
        const bloodPressure = faker.number.int({ min: 60, max: 140 });
        const insulin = faker.number.int({ min: 0, max: 200 });
        const bmi = parseFloat(
          faker.number.float({ min: 18, max: 40, precision: 0.1 }).toFixed(1)
        );

        const daysAgo = faker.number.int({ min: 1, max: 180 });
        const timestamp = new Date();
        timestamp.setDate(timestamp.getDate() - daysAgo);

        const healthData = {
          Pregnancies: pregnancies,
          Glucose: glucose,
          BloodPressure: bloodPressure,
          Insulin: insulin,
          BMI: bmi,
          Age: age,
          userId,
          timestamp: admin.firestore.Timestamp.fromDate(timestamp),
          prediction: {
            probability: parseFloat((Math.random() * 0.8 + 0.1).toFixed(2)),
            risk_level: getRiskLevel(glucose, bmi),
          },
        };

        healthPromises.push(db.collection("healthData").add(healthData));
      }

      console.log(
        `Created employee ${
          i + 1
        }/${NUM_EMPLOYEES} with ${numRecords} health records`
      );
    }

    await Promise.all([...userPromises, ...healthPromises]);

    console.log(
      `Successfully seeded database with ${NUM_EMPLOYEES} employees and their health records.`
    );
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    process.exit();
  }
}

function getRiskLevel(glucose, bmi) {
  if (glucose > 160 || bmi > 35) {
    return "High Risk";
  } else if (glucose > 120 || bmi > 30) {
    return "Medium Risk";
  } else {
    return "Low Risk";
  }
}

seedDatabase();
