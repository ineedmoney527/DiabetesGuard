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
import logger from "../utils/logger"; // Import the logger with correct syntax

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
logger.info("API_URL:", { url: API_URL });

// Set up axios interceptor to add MFA token to all requests if available
axios.interceptors.request.use(
  (config) => {
    // Get the auth token from localStorage
    const authToken = localStorage.getItem("authToken");
    if (authToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    // Add MFA code if available
    const mfaCode = sessionStorage.getItem("mfa_code");
    if (mfaCode) {
      logger.debug("Adding MFA code to request headers");
      config.headers["x-totp-code"] = mfaCode;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaPendingUser, setMfaPendingUser] = useState(null);

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

    // Log registration action
    logger.userAction("registration", {
      userId: cred.user.uid,
      email: cred.user.email,
      role: userData.role,
    });

    // 4. Return the user object so AuthContext can set currentUser
    return {
      user: cred.user,
      userInfo: { role: userData.role, isPendingVerification: true },
    };
  }

  // Login function
  async function login(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      if (!user.emailVerified) {
        return { user, userInfo: { role: null, isPendingVerification: true } };
      }

      // Check if MFA is enabled for this user
      const token = await user.getIdToken();
      const mfaResponse = await axios.get(`${API_URL}/auth/mfa/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (mfaResponse.data.mfaEnabled) {
        // Set state to indicate MFA is required
        setRequiresMfa(true);
        setMfaPendingUser(user);

        // Return special object indicating MFA is required
        return { requiresMfa: true, user };
      }

      // Normal login flow - no MFA
      const userInfo = await getUserRole(user.uid);

      // Log successful login without MFA
      logger.userAction("login_success", {
        userId: user.uid,
        email: user.email,
        role: userInfo.role,
        mfaUsed: false,
      });

      return { user, userInfo };
    } catch (error) {
      logger.error("Login error", error);
      throw error;
    }
  }

  // Verify MFA during login
  async function verifyMfaLogin(totpCode) {
    try {
      if (!mfaPendingUser) {
        throw new Error("No pending MFA authentication");
      }

      // Get a fresh token and force refresh
      const token = await mfaPendingUser.getIdToken(true);

      // Verify the TOTP code
      try {
        // Call API with TOTP code in header
        const response = await axios.get(`${API_URL}/auth/check`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-totp-code": totpCode,
          },
        });

        // Extract user data from response
        const userData = response.data.user;

        // Update auth state to use mfaPendingUser as currentUser
        // This ensures Firebase knows the user is fully authenticated
        const userWithCustomProps = mfaPendingUser;
        userWithCustomProps.role = userData.role;

        setCurrentUser(userWithCustomProps);
        setUserRole(userData.role);

        // Store the token in localStorage
        localStorage.setItem("authToken", token);

        // Store the current TOTP code in sessionStorage
        // This will be used for subsequent requests until the session ends
        sessionStorage.setItem("mfa_code", totpCode);
        logger.debug("MFA code stored for future requests");

        // Log successful login with MFA
        logger.userAction("login_success", {
          userId: mfaPendingUser.uid,
          email: mfaPendingUser.email,
          role: userData.role,
          mfaUsed: true,
        });

        // Reset the MFA required state
        setRequiresMfa(false);
        setMfaPendingUser(null);

        return { user: userWithCustomProps, userInfo: userData };
      } catch (error) {
        logger.error("TOTP verification failed", error);
        throw error;
      }
    } catch (error) {
      logger.error("MFA verification error", error);
      throw error;
    }
  }

  // Cancel MFA verification
  function cancelMfa() {
    setRequiresMfa(false);
    setMfaPendingUser(null);
    return signOut(auth);
  }

  // Fix for getUserRole function to handle missing user documents properly
  async function getUserRole(uid) {
    try {
      if (!uid) {
        logger.error("getUserRole called with empty UID");
        return {
          role: "patient", // Default role as fallback
          status: "active",
          isPendingVerification: false,
        };
      }

      const userDocRef = doc(db, "users", uid);
      const userSnapshot = await getDoc(userDocRef);

      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();

        // Get email verification status from auth user object if available
        const authUser = auth.currentUser;
        const isEmailVerified = authUser ? authUser.emailVerified : true;

        return {
          role: userData.role || "patient", // Provide default if role is undefined
          status: userData.status || "active",
          isPendingVerification: !isEmailVerified,
        };
      } else {
        logger.warn("User document not found in Firestore for UID", { uid });
        // Return default values instead of null
        return {
          role: "patient",
          status: "active",
          isPendingVerification: false,
        };
      }
    } catch (error) {
      logger.error("Error getting user role", error, { uid });
      // Return defaults instead of null
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
      // Get user information before logging out for logging purposes
      const userId = currentUser?.uid;
      const userEmail = currentUser?.email;

      // Clean up all stored user data before sign out
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");

      // Clear session storage including MFA code
      sessionStorage.removeItem("mfa_code");
      sessionStorage.clear();

      // Clear any other app-specific stored data
      // Add any other localStorage items that need to be cleared

      // Log the logout action if we have a user
      if (userId) {
        logger.userAction("logout", {
          userId,
          email: userEmail,
        });
      }

      logger.info("User data cleaned up, signing out");
      return signOut(auth);
    } catch (error) {
      logger.error("Error during logout", error);
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
        logger.error("Error sending verification email", error);
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
        logger.error("Error deleting user account", error);
        throw error;
      }
    } else {
      throw new Error("No user logged in");
    }
  }

  // Check if the stored MFA code is valid
  async function checkMfaStatus() {
    try {
      if (!currentUser) {
        return { valid: false, message: "No user logged in" };
      }

      const token = await currentUser.getIdToken(true);
      const mfaCode = sessionStorage.getItem("mfa_code");

      // Make a request to check authentication with the stored MFA code
      const response = await axios.get(`${API_URL}/auth/check`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-totp-code": mfaCode || "",
        },
      });

      return { valid: true, user: response.data.user };
    } catch (error) {
      logger.error("MFA status check error", error);

      // If we get a 403 with requireMfa=true, the MFA code is invalid or missing
      if (
        error.response &&
        error.response.status === 403 &&
        error.response.data.requireMfa
      ) {
        // Clear the invalid MFA code
        sessionStorage.removeItem("mfa_code");
        return {
          valid: false,
          requireMfa: true,
          message: "MFA verification required",
        };
      }

      return { valid: false, message: "Error checking MFA status" };
    }
  }

  // Handle user state changes
  useEffect(() => {
    logger.info("Setting up auth state listener");

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);

      if (user) {
        logger.info("User authenticated", { email: user.email });

        try {
          // Get user role and status info from Firestore
          const userInfo = await getUserRole(user.uid);

          // Store the user's token in localStorage to maintain session
          const token = await user.getIdToken();
          localStorage.setItem("authToken", token);
          logger.debug("Auth token stored in localStorage");

          if (userInfo === null) {
            // If we couldn't get user role, force token refresh and try again
            logger.warn("Role information missing, forcing token refresh");
            await user.getIdTokenResult(true); // Force refresh the token

            // Try to get user role again after token refresh
            const refreshedUserInfo = await getUserRole(user.uid);

            if (refreshedUserInfo === null) {
              logger.error("Failed to get user role after token refresh");
              // At this point, we should log out the user to avoid an inconsistent state
              logout();
              return;
            }

            // Use the refreshed user info
            const userWithCustomProps = user;
            userWithCustomProps.role = refreshedUserInfo.role;
            userWithCustomProps.status = refreshedUserInfo.status;
            userWithCustomProps.isPendingVerification =
              refreshedUserInfo.isPendingVerification;
            setCurrentUser(userWithCustomProps);
            setUserRole(refreshedUserInfo.role);
          } else {
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
          }

          logger.debug("User context updated with role and status", {
            role: userInfo?.role || "refreshed",
          });

          // Check if there's a stored MFA code and if it's still valid
          const mfaCode = sessionStorage.getItem("mfa_code");
          if (mfaCode) {
            logger.debug("Found stored MFA code, verifying validity");
            // This will be handled by the axios interceptor
          }
        } catch (error) {
          logger.error("Error during auth state change processing", error);
          // If the error is specifically a Firestore permission error during initial role fetch,
          // it might be a temporary issue. Log out cleanly.
          if (
            error.code === "permission-denied" ||
            (error.message && error.message.includes("permission-denied"))
          ) {
            logger.warn("Permission denied fetching user role, logging out");
            // Call logout directly to ensure proper cleanup
            logout();
          } else {
            // For other errors, force a token refresh and try again instead of defaulting to patient
            logger.error("Error during auth, forcing token refresh");
            try {
              await user.getIdTokenResult(true); // Force refresh the token
              // Log out if we're still having issues after refresh
              logout();
            } catch (refreshError) {
              logger.error("Token refresh failed", refreshError);
              logout();
            }
          }
        }
      } else {
        logger.info("No user authenticated");
        setCurrentUser(null);
        setUserRole(null);
        // Clear auth token and MFA code if logged out
        localStorage.removeItem("authToken");
        sessionStorage.removeItem("mfa_code");
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
    logout,
    register,
    resetPassword,
    resendVerificationEmail,
    cancelRegistration,
    requiresMfa,
    verifyMfaLogin,
    cancelMfa,
    checkMfaStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
