import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Box, CircularProgress } from "@mui/material";

const ProtectedRoute = ({ children, adminOnly = false, roles = [] }) => {
  const { currentUser, loading, userRole } = useAuth();

  // Show loading indicator while auth state is being determined
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

  // Redirect to login if not authenticated
  if (!currentUser) {
    console.log("ProtectedRoute: No authenticated user, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // Get effective role from context state or user object
  const effectiveRole = userRole || currentUser.role;
  console.log(
    "ProtectedRoute: User role check - effective role:",
    effectiveRole
  );

  // Check for health professional with inactive status
  if (effectiveRole === "doctor" && currentUser.status === "inactive") {
    console.log(
      "ProtectedRoute: Health Professional account is inactive, redirecting to pending approval page"
    );
    return <Navigate to="/pending-approval" replace />;
  }

  // Check if admin-only route
  if (adminOnly && effectiveRole !== "admin") {
    console.log(
      "ProtectedRoute: Admin-only route, redirecting non-admin to dashboard"
    );
    return <Navigate to="/dashboard" replace />;
  }

  // Check if user has one of the required roles
  if (roles.length > 0 && !roles.includes(effectiveRole)) {
    console.log(
      "ProtectedRoute: User lacks required role, redirecting to dashboard"
    );
    return <Navigate to="/dashboard" replace />;
  }

  // User is authenticated and has required role
  return children;
};

export default ProtectedRoute;
