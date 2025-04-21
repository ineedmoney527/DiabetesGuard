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
  Backdrop,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Divider,
} from "@mui/material";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";

// Validation Schema
const validationSchema = Yup.object({
  name: Yup.string().required("Full name is required"),
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
  password: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .required("Password is required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password"), null], "Passwords must match")
    .required("Confirm password is required"),
  gender: Yup.string().required("Gender is required"),
  birthdate: Yup.date().required("Birthdate is required"),
  role: Yup.string().required("Role is required"),
  position: Yup.string().when("role", {
    is: "employee",
    then: () => Yup.string().required("Position is required"),
    otherwise: () => Yup.string(),
  }),
});

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      gender: "",
      birthdate: null,
      role: "employee", // Default role
      position: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      console.log("Attempting registration for:", values.email);

      try {
        // Convert birthdate to ISO string
        const birthdate = values.birthdate.toISOString().split("T")[0];
        toast.info("Registering...");
        // Prepare user data for Firebase
        const userData = {
          name: values.name,
          email: values.email,
          gender: values.gender,
          birthdate: birthdate,
          role: values.role,
          position: values.position,
        };

        // Register user
        const { userInfo } = await register(
          values.email,
          values.password,
          userData
        );

        toast.success(
          "Registration successful! Please verify your email before logging in."
        );
        console.log("User info:", userInfo);

        if (userInfo.isPendingVerification) {
          console.log("Navigating to verify-email");
          // Keep loading=true so Backdrop persists until unmount
          navigate("/verify-email", {
            replace: true,
            state: { email: values.email },
          });
          return; // skip clearing loading
        }
      } catch (error) {
        console.error("Registration error:", error);
        const errorMessage =
          error.code === "auth/email-already-in-use"
            ? "This email is already registered"
            : error.message;
        toast.error(errorMessage);
        setLoading(false); // only clear on error
      }
    },
  });

  return (
    <Container component="main" maxWidth="sm" sx={{ py: 4 }}>
      {/* Loading Backdrop */}
      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper elevation={3} sx={{ p: { xs: 3, md: 5 }, borderRadius: 2 }}>
          {/* Header */}
          <Box sx={{ mb: 4, textAlign: "center" }}>
            <Typography component="h1" variant="h4" gutterBottom>
              Create Your Account
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Join our healthcare platform to manage your health better
            </Typography>
            <Divider sx={{ my: 3 }} />
          </Box>

          {/* Form */}
          <Box component="form" onSubmit={formik.handleSubmit} noValidate>
            <Grid container spacing={2}>
              {/* Full Name */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Full Name"
                  id="name"
                  name="name"
                  variant="outlined"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.name && Boolean(formik.errors.name)}
                  helperText={formik.touched.name && formik.errors.name}
                  disabled={loading}
                />
              </Grid>

              {/* Email & Gender */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email Address"
                  id="email"
                  name="email"
                  type="email"
                  variant="outlined"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.email && Boolean(formik.errors.email)}
                  helperText={formik.touched.email && formik.errors.email}
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl
                  fullWidth
                  error={formik.touched.gender && Boolean(formik.errors.gender)}
                  disabled={loading}
                >
                  <InputLabel id="gender-label">Gender</InputLabel>
                  <Select
                    labelId="gender-label"
                    id="gender"
                    name="gender"
                    value={formik.values.gender}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    label="Gender"
                  >
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    {/* <MenuItem value="other">Other</MenuItem> */}
                  </Select>
                  {formik.touched.gender && formik.errors.gender && (
                    <FormHelperText>{formik.errors.gender}</FormHelperText>
                  )}
                </FormControl>
              </Grid>

              {/* Birthdate & Role */}
              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Birthdate"
                    value={formik.values.birthdate}
                    onChange={(date) => formik.setFieldValue("birthdate", date)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        name="birthdate"
                        onBlur={formik.handleBlur}
                        error={
                          formik.touched.birthdate &&
                          Boolean(formik.errors.birthdate)
                        }
                        helperText={
                          formik.touched.birthdate && formik.errors.birthdate
                        }
                        disabled={loading}
                      />
                    )}
                    disabled={loading}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl
                  fullWidth
                  error={formik.touched.role && Boolean(formik.errors.role)}
                  disabled={loading}
                >
                  <InputLabel id="role-label">Register as</InputLabel>
                  <Select
                    labelId="role-label"
                    id="role"
                    name="role"
                    value={formik.values.role}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    label="Register as"
                  >
                    <MenuItem value="employee">Employee</MenuItem>
                    <MenuItem value="doctor">
                      Health Professional / Doctor
                    </MenuItem>
                  </Select>
                  {formik.touched.role && formik.errors.role && (
                    <FormHelperText>{formik.errors.role}</FormHelperText>
                  )}
                  {formik.values.role === "doctor" && (
                    <FormHelperText>
                      Note: Health Professional accounts require admin approval
                    </FormHelperText>
                  )}
                </FormControl>
              </Grid>

              {/* Position field - only for employees */}
              {formik.values.role === "employee" && (
                <Grid item xs={12}>
                  <FormControl
                    fullWidth
                    error={
                      formik.touched.position && Boolean(formik.errors.position)
                    }
                    disabled={loading}
                  >
                    <InputLabel id="position-label">Position</InputLabel>
                    <Select
                      labelId="position-label"
                      id="position"
                      name="position"
                      value={formik.values.position}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      label="Position"
                    >
                      <MenuItem value="driver">Driver</MenuItem>
                      <MenuItem value="cook">Cook</MenuItem>
                      <MenuItem value="chef">Chef</MenuItem>
                      <MenuItem value="kitchen_helper">Kitchen Helper</MenuItem>
                      <MenuItem value="truck_driver">Truck Driver</MenuItem>
                      <MenuItem value="baker">Baker</MenuItem>
                      <MenuItem value="food_tester">Food Tester</MenuItem>
                    </Select>
                    {formik.touched.position && formik.errors.position && (
                      <FormHelperText>{formik.errors.position}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>
              )}

              {/* Password & Confirm Password */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  id="password"
                  name="password"
                  label="Password"
                  type="password"
                  variant="outlined"
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

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  id="confirmPassword"
                  name="confirmPassword"
                  label="Confirm Password"
                  type="password"
                  variant="outlined"
                  value={formik.values.confirmPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={
                    formik.touched.confirmPassword &&
                    Boolean(formik.errors.confirmPassword)
                  }
                  helperText={
                    formik.touched.confirmPassword &&
                    formik.errors.confirmPassword
                  }
                  disabled={loading}
                />
              </Grid>
            </Grid>

            {/* Submit Button */}
            <Box sx={{ mt: 4 }}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                sx={{ py: 1.5, borderRadius: 2 }}
                disabled={loading}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Create Account"
                )}
              </Button>

              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Already have an account?{" "}
                  <Link component={RouterLink} to="/login" variant="body2">
                    Sign in here
                  </Link>
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>
      </motion.div>
    </Container>
  );
};

export default Register;
