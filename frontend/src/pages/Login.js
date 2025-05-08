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
  IconButton,
  InputAdornment,
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
import { Visibility, VisibilityOff } from "@mui/icons-material";
import logger from "../utils/logger";

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
  const {
    login,
    resendVerificationEmail,
    logout,
    currentUser,
    requiresMfa,
    verifyMfaLogin,
    cancelMfa,
  } = useAuth();

  // --- State Variables ---
  const [loading, setLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationSending, setVerificationSending] = useState(false);
  const [tooManyRequestsError, setTooManyRequestsError] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // MFA verification state
  const [showMfaVerification, setShowMfaVerification] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

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

  // Handle form submission with Formik
  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    validationSchema,
    onSubmit: async (values, formikHelpers) => {
      try {
        setIsLoggingIn(true);
        await attemptLogin(values, formikHelpers);
      } catch (error) {
        logger.error("Login error", error);
        setIsLoggingIn(false);
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
      logger.error("Error checking doctor status", error);
      return "active"; // Default to active on error
    }
  };

  // Attempt to log in
  const attemptLogin = async (values, formikHelpers) => {
    setIsLoggingIn(true);
    try {
      setLoading(true);
      setError("");

      const result = await login(values.email, values.password);

      // Handle MFA requirement
      if (result.requiresMfa) {
        // Show MFA verification screen
        setShowMfaVerification(true);
        setLoading(false);
        formikHelpers.setSubmitting(false);
        return;
      }

      // If the user has not verified their email
      if (result.userInfo.isPendingVerification) {
        // Use the existing verification dialog
        setVerificationEmail(values.email);
        setVerificationDialogOpen(true);
        setLoading(false);
        formikHelpers.setSubmitting(false);
      } else {
        logger.debug("Login successful", { role: result.userInfo.role });
        // If everything is good, navigate to dashboard
        if (result.userInfo.role === "admin") {
          navigate("/admin");
        } else if (result.userInfo.role === "doctor") {
          navigate("/doctor-dashboard");
        } else {
          navigate("/patient-dashboard");
        }
      }
    } catch (error) {
      logger.error("Login error", error);

      // Handle specific error cases
      if (error.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (error.code === "auth/user-disabled") {
        setError("This account has been disabled.");
      } else if (error.code === "auth/too-many-requests") {
        setTooManyRequestsError(true);
      } else {
        setError("Failed to log in. Please try again.");
      }
    } finally {
      setLoading(false);
      formikHelpers.setSubmitting(false);
      setIsLoggingIn(false);
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
      logger.error("Error sending verification email", error);
      if (error.code === "auth/wrong-password") {
        toast.error("Incorrect password. Please try again.");
      } else {
        toast.error("Failed to send verification email. Please try again.");
      }
    } finally {
      setVerificationSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      const result = await login(formik.values.email, formik.values.password);

      if (result.requiresMfa) {
        // Show MFA verification screen
        setShowMfaVerification(true);
        setLoading(false);
        return;
      }

      if (result.userInfo.isPendingVerification) {
        navigate("/verify-email");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      logger.error("Login error", error);
      if (error.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (error.code === "auth/user-disabled") {
        setError("This account has been disabled.");
      } else {
        setError("Failed to log in. Please try again.");
      }
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    try {
      setMfaLoading(true);
      setMfaError("");
      setIsLoggingIn(true);

      const result = await verifyMfaLogin(totpCode);

      // Successful verification
      if (result.userInfo.isPendingVerification) {
        setVerificationEmail(result.user.email);
        setVerificationDialogOpen(true);
        setMfaLoading(false);
      } else {
        // Navigate based on role
        if (result.userInfo.role === "admin") {
          navigate("/admin");
        } else if (result.userInfo.role === "doctor") {
          navigate("/doctor-dashboard");
        } else {
          navigate("/patient-dashboard");
        }
      }
    } catch (error) {
      logger.error("MFA verification error", error);
      setMfaError(
        error.message || "Invalid verification code. Please try again."
      );
      setMfaLoading(false);
      setIsLoggingIn(false);
    }
  };

  const handleCancelMfa = async () => {
    try {
      await cancelMfa();
      setShowMfaVerification(false);
      setTotpCode("");
      setMfaError("");
    } catch (error) {
      logger.error("Error cancelling MFA", error);
    }
  };

  const handleTotpChange = (e) => {
    // Only allow numbers and limit to 6 digits
    const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
    setTotpCode(value);
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  // Show MFA verification screen if required
  if (showMfaVerification || requiresMfa) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" align="center" gutterBottom>
            Two-Factor Authentication
          </Typography>
          <Typography
            variant="body1"
            align="center"
            color="text.secondary"
            sx={{ mb: 3 }}
          >
            Please enter the verification code from your authenticator app
          </Typography>

          {mfaError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {mfaError}
            </Alert>
          )}

          <form onSubmit={handleVerifyMfa}>
            <TextField
              label="6-digit verification code"
              value={totpCode}
              onChange={handleTotpChange}
              fullWidth
              required
              variant="outlined"
              margin="normal"
              inputProps={{ maxLength: 6 }}
              placeholder="000000"
              autoFocus
            />

            <Box
              sx={{ mt: 3, display: "flex", justifyContent: "space-between" }}
            >
              <Button
                variant="outlined"
                onClick={handleCancelMfa}
                disabled={mfaLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={totpCode.length !== 6 || mfaLoading}
              >
                {mfaLoading ? <CircularProgress size={24} /> : "Verify"}
              </Button>
            </Box>
          </form>
        </Paper>
      </Container>
    );
  }

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
          <Box component="form" onSubmit={handleSubmit} noValidate>
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
                  type={showPassword ? "text" : "password"}
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
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={handleClickShowPassword}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
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

            {error && (
              <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                {error}
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
