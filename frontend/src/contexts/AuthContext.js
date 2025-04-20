//AuthContext.js
import React, { createContext, useState, useContext, useEffect } from "react";
import { initializeApp } from "firebase/app";
// import { signOut } from "firebase/auth";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification,
  deleteUser,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { toast } from "react-toastify";
import axios from "axios"; // Make sure axios is imported

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// API base URL
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";
console.log("API_URL:", API_URL);

// Create Auth Context
const AuthContext = createContext();

// Custom hook to use Auth Context
export function useAuth() {
  return useContext(AuthContext);
}

// Auth Provider Component
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Register function
  async function register(email, password, userData) {
    // 1. Create & sign in
    const auth = getAuth();
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // 2. Save the rest of your profile server‑side
    await axios.post(`${API_URL}/auth/createProfile`, {
      uid: cred.user.uid,
      ...userData,
    });

    // 3. Send the verification email
    await sendEmailVerification(cred.user);

    // 4. Return the user object so AuthContext can set currentUser
    return {
      user: cred.user,
      userInfo: { role: userData.role, isPendingVerification: true },
    };
  }

  // Login function

  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;

    if (!user.emailVerified) {
      return { user, userInfo: { role: null, isPendingVerification: true } };
    }

    const userInfo = await getUserRole(user.uid);
    return { user, userInfo };
  }

  // Get user role from Firestore
  async function getUserRole(uid) {
    try {
      const userDocRef = doc(db, "users", uid);
      const userSnapshot = await getDoc(userDocRef);

      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();

        // Get email verification status from auth user object if available
        // instead of from Firestore
        const authUser = auth.currentUser;
        const isEmailVerified = authUser ? authUser.emailVerified : true;

        return {
          role: userData.role || "patient",
          status: userData.status || "active",
          isPendingVerification: !isEmailVerified,
        };
      } else {
        // Default role if user document not found
        return {
          role: "patient",
          status: "active",
          isPendingVerification: false,
        };
      }
    } catch (error) {
      console.error("Error getting user role:", error);
      return {
        role: "patient",
        status: "active",
        isPendingVerification: false,
      };
    }
  }

  // Updated version with comprehensive cleanup:
  async function logout() {
    try {
      // Clean up all stored user data before sign out
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      sessionStorage.clear(); // Clear any session storage data

      // Clear any other app-specific stored data
      // Add any other localStorage items that need to be cleared

      console.log("User data cleaned up, signing out");
      return signOut(auth);
    } catch (error) {
      console.error("Error during logout:", error);
      throw error;
    }
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  // Resend verification email
  async function resendVerificationEmail() {
    if (currentUser && !currentUser.emailVerified) {
      try {
        await sendEmailVerification(currentUser);
        return true;
      } catch (error) {
        console.error("Error sending verification email:", error);
        throw error;
      }
    } else {
      throw new Error("No user logged in or email already verified");
    }
  }

  // Delete user account
  async function cancelRegistration() {
    if (currentUser) {
      try {
        // Delete the user from Firebase Authentication
        await deleteUser(currentUser);
        // Clear any local storage or session data
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
        sessionStorage.clear();
        setCurrentUser(null);
        setUserRole(null);
        return true;
      } catch (error) {
        console.error("Error deleting user account:", error);
        throw error;
      }
    } else {
      throw new Error("No user logged in");
    }
  }

  // Handle user state changes
  useEffect(() => {
    console.log("Setting up auth state listener");

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);

      if (user) {
        console.log("User authenticated:", user.email);

        try {
          // Get user role and status info from Firestore
          const userInfo = await getUserRole(user.uid);

          // Store the user's token in localStorage to maintain session
          const token = await user.getIdToken();
          localStorage.setItem("authToken", token);
          console.log("Auth token stored in localStorage");

          // Update user state with role information -
          // Preserve the original user object with its methods
          // and assign properties instead of spreading
          const userWithCustomProps = user;
          userWithCustomProps.role = userInfo.role;
          userWithCustomProps.status = userInfo.status;
          userWithCustomProps.isPendingVerification =
            userInfo.isPendingVerification;
          setCurrentUser(userWithCustomProps);

          // Set the userRole state explicitly
          setUserRole(userInfo.role);

          console.log("User context updated with role, status:", userInfo);
        } catch (error) {
          console.error("Error updating user context:", error);
          // Preserve the original user object with its methods
          const userWithDefaultRole = user;
          userWithDefaultRole.role = "patient"; // Default role if error
          setCurrentUser(userWithDefaultRole);
          setUserRole("patient");
        }
      } else {
        console.log("No user authenticated");
        setCurrentUser(null);
        setUserRole(null);
        // Clear auth token if logged out
        localStorage.removeItem("authToken");
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    loading,
    login,
    register,
    logout,
    resetPassword,
    getUserRole,
    resendVerificationEmail,
    cancelRegistration,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
