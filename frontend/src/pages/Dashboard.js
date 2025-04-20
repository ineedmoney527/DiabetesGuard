import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  Avatar,
  Toolbar,
  CircularProgress,
} from "@mui/material";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-toastify";

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, userRole, logout, loading } = useAuth();

  // This effect redirects users to their role-specific dashboards
  useEffect(() => {
    console.log(
      "Dashboard effect running with userRole:",
      userRole,
      "loading:",
      loading
    );

    // Wait for authentication to complete
    if (loading) {
      console.log("Auth still loading, waiting...");
      return;
    }

    // If not logged in, redirect to login
    if (!currentUser) {
      console.log("No current user, redirecting to login");
      navigate("/login");
      return;
    }

    // Check user role from currentUser object as a backup
    const effectiveRole = userRole || currentUser.role;
    console.log("Effective role:", effectiveRole);

    // Check if doctor with inactive status
    if (effectiveRole === "doctor" && currentUser.status === "inactive") {
      console.log(
        "Doctor account is inactive, redirecting to pending approval page"
      );
      navigate("/pending-approval");
      return;
    }

    // Redirect based on role
    if (effectiveRole === "employee") {
      console.log("Redirecting to employee dashboard");
      navigate("/patient-dashboard");
    } else if (effectiveRole === "doctor") {
      console.log("Redirecting to health professional dashboard");
      navigate("/doctor-dashboard");
    } else if (effectiveRole === "admin") {
      console.log("Redirecting to admin dashboard");
      navigate("/admin");
    } else {
      console.log("No recognized role found:", effectiveRole);
    }
  }, [currentUser, userRole, loading, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Failed to log out");
    }
  };

  // Show loading indicator while authentication state is being determined
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Diabetes Guard
          </Typography>
          <Button color="inherit" onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper
                elevation={3}
                sx={{
                  p: 4,
                  borderRadius: 2,
                  background:
                    "linear-gradient(135deg, #2196f3 0%, #f50057 100%)",
                  color: "white",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                  <Avatar
                    sx={{
                      width: 80,
                      height: 80,
                      bgcolor: "white",
                      color: "primary.main",
                      fontSize: "2rem",
                      mr: 2,
                    }}
                  >
                    {currentUser?.displayName?.[0] || "U"}
                  </Avatar>
                  <Box>
                    <Typography variant="h4" component="h1">
                      Welcome, {currentUser?.displayName || "User"}!
                    </Typography>
                    <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                      Redirecting to your dashboard...
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </motion.div>
      </Container>
    </Box>
  );
};

export default Dashboard;
