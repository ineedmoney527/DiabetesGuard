import React, { useState } from "react";
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
  Alert,
} from "@mui/material";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios"; // Import axios for API calls

// Validation Schema
const validationSchema = Yup.object({
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
});

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");

  // Function to check if user exists
  const checkUserExists = async (email) => {
    try {
      // Call the backend API to check if user exists
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/auth/check-user-exists`,
        { email }
      );
      return response.data.exists;
    } catch (error) {
      console.error("Error checking if user exists:", error);
      // If there's an error, assume user doesn't exist for security reasons
      return false;
    }
  };

  const formik = useFormik({
    initialValues: {
      email: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError("");

        // First check if user exists
        const userExists = await checkUserExists(values.email);

        if (!userExists) {
          setError("No account found with this email address");
          toast.error("No account found with this email address");
          return;
        }

        // If user exists, proceed with password reset
        await resetPassword(values.email);
        setEmailSent(true);
        toast.success("Password reset email sent successfully!");
      } catch (error) {
        console.error("Error sending password reset email:", error);
        let errorMessage = "Failed to send password reset email";

        if (error.code === "auth/user-not-found") {
          errorMessage = "No account found with this email address";
        }

        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ width: "100%" }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Typography component="h1" variant="h4" gutterBottom>
              Reset Password
            </Typography>

            {emailSent ? (
              <>
                <Alert severity="success" sx={{ mt: 2, mb: 2, width: "100%" }}>
                  Password reset email sent successfully!
                </Alert>
                <Typography variant="body1" align="center" paragraph>
                  We've sent instructions to reset your password to:
                </Typography>
                <Typography
                  variant="h6"
                  color="primary"
                  gutterBottom
                  align="center"
                >
                  {formik.values.email}
                </Typography>
                <Typography
                  variant="body1"
                  align="center"
                  sx={{ mt: 2 }}
                  paragraph
                >
                  Please check your inbox and follow the link in the email to
                  reset your password.
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={() => navigate("/login")}
                  sx={{ mt: 3 }}
                >
                  Return to Login
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body1" sx={{ mb: 3 }}>
                  Enter your email address below and we'll send you instructions
                  to reset your password.
                </Typography>

                {error && (
                  <Alert severity="error" sx={{ mb: 2, width: "100%" }}>
                    {error}
                  </Alert>
                )}

                <Box
                  component="form"
                  onSubmit={formik.handleSubmit}
                  sx={{ mt: 1, width: "100%" }}
                >
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

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    sx={{ mt: 3, mb: 2 }}
                    disabled={loading}
                  >
                    {loading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>

                  <Box textAlign="center">
                    <Link component={RouterLink} to="/login" variant="body2">
                      Back to Login
                    </Link>
                  </Box>
                </Box>
              </>
            )}
          </Paper>
        </motion.div>
      </Box>
    </Container>
  );
};

export default ForgotPassword;
