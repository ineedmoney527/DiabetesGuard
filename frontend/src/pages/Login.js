//Login.js
import React, { useState, useEffect } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Link,
  CircularProgress,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider,
} from "@mui/material";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import {
  getAuth,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

// Validation Schema for email/password form
const validationSchema = Yup.object({
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
  password: Yup.string().required("Password is required"),
});

// Component Definition
const Login = () => {
  const navigate = useNavigate();
  const { login, resendVerificationEmail, logout, currentUser } = useAuth();

  // --- State Variables ---
  const [loading, setLoading] = useState(false);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationSending, setVerificationSending] = useState(false);
  const [tooManyRequestsError, setTooManyRequestsError] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // --- Refs ---
  const auth = getAuth(); // Firebase Auth instance
  const db = getFirestore();

  // Cooldown timer for resend button
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Auto-logo ut effect - sign out any authenticated user when they reach the login page
  useEffect(() => {
    const autoLogout = async () => {
      if (currentUser) {
        try {
          console.log("Auto-logout: Signing out existing user");
          await logout();
          // toast.info("You've been signed out for a new session");
        } catch (error) {
          console.error("Auto-logout error:", error);
        }
      }
    };

    autoLogout();
  }, [currentUser, logout]);

  // Handle form submission with Formik
  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        await handleLogin(values);
      } catch (error) {
        console.error("Login error:", error);
      }
    },
  });

  // Check if doctor is active
  const checkDoctorStatus = async (uid) => {
    try {
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();

        // If user is a doctor, check their status
        if (userData.role === "doctor") {
          return userData.status || "active"; // Default to active if status is not set
        }
      }

      return "active"; // Default for non-doctors
    } catch (error) {
      console.error("Error checking doctor status:", error);
      return "active"; // Default to active on error
    }
  };

  // Standard Email/Password Login
  const handleLogin = async (values) => {
    setLoading(true);

    try {
      console.log("Attempting login for:", values.email);

      // Use the login function from AuthContext instead of direct Firebase call
      const result = await login(values.email, values.password);
      console.log("Login result:", result);
      if (result.userInfo.isPendingVerification) {
        // pass email (and uid if you need it) to the verification page
        navigate("/verify-email", { state: { email: values.email } });
        return;
      }
      const user = result.user;
      const userInfo = result.userInfo;

      console.log("Login successful for:", user.email);

      // Check if doctor account is inactive
      if (userInfo.role === "doctor" && userInfo.status === "inactive") {
        toast.warning(
          "Your doctor account is pending approval by an administrator."
        );
        // Still allow login but show a warning
      }

      // Redirect based on role
      if (userInfo.role === "admin") {
        toast.success("Admin login successful!");
        navigate("/admin");
      } else if (userInfo.role === "doctor") {
        toast.success("Doctor login successful!");
        navigate("/doctor-dashboard");
      } else {
        toast.success("Login successful!");
        navigate("/patient-dashboard");
      }
    } catch (error) {
      if (error.code === "auth/too-many-requests") {
        setTooManyRequestsError(true);
        toast.error("Too many failed login attempts…");
      } else if (error.code === "auth/email-not-verified") {
        // now a clear, guaranteed code match
        // setVerificationEmail(values.email);
        // setVerificationDialogOpen(true);
      } else {
        const msg =
          error.code === "auth/wrong-password" ||
          error.code === "auth/user-not-found"
            ? "Invalid email or password"
            : error.message;
        toast.error("Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle resending verification email
  const handleResendVerification = async () => {
    try {
      setVerificationSending(true);

      // Since the user was signed out, we need to sign in temporarily to send the verification
      const tempAuth = getAuth();
      // Only attempt sign in if we have the email and a password from the form
      if (verificationEmail && formik.values.password) {
        // Sign in temporarily
        const userCredential = await signInWithEmailAndPassword(
          tempAuth,
          verificationEmail,
          formik.values.password
        );
        const user = userCredential.user;
        setVerificationDialogOpen(true);
        // // Send verification email
        await sendEmailVerification(user);

        // Sign out again
        await signOut(tempAuth);

        // Set cooldown
        setResendCooldown(60);

        toast.success("Verification email sent successfully!");
      } else {
        toast.error("Please enter your password to resend verification email");
      }
    } catch (error) {
      console.error("Error sending verification email:", error);
      if (error.code === "auth/wrong-password") {
        toast.error("Incorrect password. Please try again.");
      } else {
        toast.error("Failed to send verification email. Please try again.");
      }
    } finally {
      setVerificationSending(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm" sx={{ py: 4 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper elevation={3} sx={{ p: { xs: 3, md: 5 }, borderRadius: 2 }}>
          {/* Header */}
          <Box sx={{ mb: 4, textAlign: "center" }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                mb: 2,
              }}
            >
              <Box
                sx={{
                  bgcolor: "primary.main",
                  color: "white",
                  borderRadius: "50%",
                  p: 1,
                  display: "flex",
                }}
              >
                <LockOutlinedIcon fontSize="large" />
              </Box>
            </Box>
            <Typography component="h1" variant="h4" gutterBottom>
              Sign In
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Welcome back to Diabetes Guard
            </Typography>
            <Divider sx={{ my: 3 }} />
          </Box>

          {/* Form */}
          <Box component="form" onSubmit={formik.handleSubmit} noValidate>
            <Grid container spacing={2}>
              {/* Email */}
              <Grid item xs={12}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="Email Address"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.email && Boolean(formik.errors.email)}
                  helperText={formik.touched.email && formik.errors.email}
                  disabled={loading}
                />
              </Grid>

              {/* Password */}
              <Grid item xs={12}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={
                    formik.touched.password && Boolean(formik.errors.password)
                  }
                  helperText={formik.touched.password && formik.errors.password}
                  disabled={loading}
                />
              </Grid>
            </Grid>

            {tooManyRequestsError && (
              <Alert
                severity="error"
                sx={{ mt: 2, mb: 2 }}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    component={RouterLink}
                    to="/forgot-password"
                  >
                    Reset Password
                  </Button>
                }
              >
                Your account has been temporarily locked due to too many failed
                login attempts. Please reset your password or try again later.
              </Alert>
            )}

            {/* Login Button */}
            <Box sx={{ mt: 3 }}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{ py: 1.5, borderRadius: 2 }}
                disabled={loading}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Sign In"
                )}
              </Button>

              {/* Links */}
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid
                  item
                  xs={12}
                  sm={6}
                  sx={{ textAlign: { xs: "center", sm: "left" } }}
                >
                  <Link
                    component={RouterLink}
                    to="/forgot-password"
                    variant="body2"
                  >
                    Forgot password?
                  </Link>
                </Grid>
                <Grid
                  item
                  xs={12}
                  sm={6}
                  sx={{ textAlign: { xs: "center", sm: "right" } }}
                >
                  <Link component={RouterLink} to="/register" variant="body2">
                    {"Don't have an account? Sign Up"}
                  </Link>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </Paper>
      </motion.div>

      {/* Email Verification Dialog */}
      <Dialog
        open={verificationDialogOpen}
        onClose={() => setVerificationDialogOpen(false)}
      >
        <DialogTitle>Email Verification Required</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your email address has not been verified yet. Please check your
            inbox and click on the verification link.
            <br />
            <br />
            If you don't see the email, check your spam folder or click the
            button below to receive a new verification email.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerificationDialogOpen(false)}>
            Close
          </Button>
          <Button
            onClick={handleResendVerification}
            variant="contained"
            color="primary"
            disabled={verificationSending || resendCooldown > 0}
          >
            {verificationSending ? (
              <CircularProgress size={24} />
            ) : resendCooldown > 0 ? (
              `Resend in ${resendCooldown}s`
            ) : (
              "Resend Verification Email"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Login;
