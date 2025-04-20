// create-admin.js - Save this to a file and run with Node.js
require("dotenv").config();
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Admin credentials
const ADMIN_EMAIL = "coffeebean2jh@gmail.com";
const ADMIN_PASSWORD = "12345678";
const ADMIN_PHONE = "+60197540728";

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function createOrUpdateAdmin() {
  try {
    console.log(`Creating/updating admin user: ${ADMIN_EMAIL}`);

    // Check if user already exists
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(ADMIN_EMAIL);
      console.log("Admin user already exists, updating...");
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        // Create new user
        userRecord = await admin.auth().createUser({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          displayName: "Admin User",
          phoneNumber: ADMIN_PHONE,
          emailVerified: true,
        });
        console.log("Created new admin user");
      } else {
        throw error;
      }
    }

    // Update user document in Firestore
    await admin.firestore().collection("users").doc(userRecord.uid).set(
      {
        email: ADMIN_EMAIL,
        name: "Admin User",
        role: "admin",
        status: "active",
        phone: ADMIN_PHONE,
        birthdate: "1990-01-01",
        gender: "other",
        emailVerified: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`Admin user created/updated with UID: ${userRecord.uid}`);
    return userRecord.uid;
  } catch (error) {
    console.error("Error creating admin user:", error);
    throw error;
  }
}

createOrUpdateAdmin()
  .then((uid) => {
    console.log(`Admin setup complete with UID: ${uid}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
