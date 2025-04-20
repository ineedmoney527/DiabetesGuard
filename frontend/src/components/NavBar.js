import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Button,
  Chip,
  Divider,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { AccountCircle, ArrowDropDown } from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const NavBar = () => {
  const { currentUser, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    navigate("/profile");
    handleMenuClose();
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Failed to log out", error);
    }
    handleMenuClose();
  };

  const handleDashboardClick = () => {
    // Navigate to the appropriate dashboard based on user role
    if (userRole === "doctor") {
      navigate("/doctor-dashboard");
    } else if (userRole === "employee") {
      navigate("/patient-dashboard");
    } else if (userRole === "admin") {
      navigate("/admin");
    } else {
      navigate("/dashboard");
    }
  };

  // Get the display name for the role
  const getRoleDisplayName = (role) => {
    if (role === "doctor") return "Health Professional";
    if (role === "employee") return "Employee";
    if (role === "admin") return "Admin";
    return "User";
  };

  return (
    <AppBar position="static" color="primary" elevation={1}>
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: 1,
            fontWeight: "bold",
            cursor: "pointer",
            "&:hover": {
              opacity: 0.8,
            },
          }}
          onClick={handleDashboardClick}
        >
          DiabetesGuard
        </Typography>

        {currentUser && (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {!isMobile && (
              <>
                <Chip
                  label={getRoleDisplayName(userRole)}
                  color="secondary"
                  size="small"
                  sx={{ mr: 1 }}
                />
                <Typography variant="body2" sx={{ mr: 1 }}>
                  {currentUser.displayName || currentUser.email}
                </Typography>
              </>
            )}
            <IconButton
              onClick={handleMenuOpen}
              color="inherit"
              aria-label="account"
              aria-controls="user-menu"
              aria-haspopup="true"
              aria-expanded={open ? "true" : undefined}
            >
              {currentUser.photoURL ? (
                <Avatar
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || "User"}
                  sx={{ width: 32, height: 32 }}
                />
              ) : (
                <AccountCircle />
              )}
              <ArrowDropDown />
            </IconButton>

            <Menu
              id="user-menu"
              anchorEl={anchorEl}
              open={open}
              onClose={handleMenuClose}
              MenuListProps={{
                "aria-labelledby": "user-button",
              }}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
            >
              {isMobile && (
                <>
                  <MenuItem disabled>
                    {currentUser.displayName || currentUser.email}
                  </MenuItem>
                  <MenuItem disabled>
                    Role: {getRoleDisplayName(userRole)}
                  </MenuItem>
                  <Divider />
                </>
              )}
              <MenuItem onClick={handleProfileClick}>Profile</MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default NavBar;
