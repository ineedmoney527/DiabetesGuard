import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Link,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { getAuth, sendEmailVerification } from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import CancelIcon from "@mui/icons-material/Cancel";

const EmailVerification = () => {
  const { currentUser, resendVerificationEmail, cancelRegistration } =
    useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Get email from location state or current user
  useEffect(() => {
    if (location.state && location.state.email) {
      setEmail(location.state.email);
    } else if (currentUser) {
      setEmail(currentUser.email);
    } else {
      // If no email is found, redirect to login
      navigate("/login");
    }
  }, [location, currentUser, navigate]);

  // Timer for email resend
  useEffect(() => {
    if (timer > 0 && !canResend) {
      const countdown = setInterval(() => {
        setTimer((prevTimer) => prevTimer - 1);
      }, 1000);
      return () => clearInterval(countdown);
    } else if (timer === 0 && !canResend) {
      setCanResend(true);
    }
  }, [timer, canResend]);

  useEffect(() => {
    if (!currentUser) {
      console.log("No current user found, skipping verification check.");
      return;
    }

    const checkEmailVerification = async () => {
      console.log("Checking email verification status...");

      try {
        await currentUser.reload(); // Refresh user info from Firebase
        console.log(
          "User reloaded. Email verified status:",
          currentUser.emailVerified
        );

        if (currentUser.emailVerified) {
          toast.success("Email verified successfully!");
          console.log("Email verified. Redirecting to /login...");
          navigate("/login");
        } else {
          console.log("Email not verified yet.");
        }
      } catch (error) {
        console.error("Error checking email verification:", error);
      }
    };

    checkEmailVerification();

    const interval = setInterval(() => {
      console.log("Interval tick: checking verification...");
      checkEmailVerification();
    }, 5000);

    return () => {
      console.log("Clearing verification interval...");
      clearInterval(interval);
    };
  }, [currentUser, navigate]);

  // Process pending navigation after dialog is closed without cancellation
  useEffect(() => {
    if (!cancelDialogOpen && pendingNavigation) {
      if (pendingNavigation.type === "navigate") {
        navigate(pendingNavigation.to);
      } else if (pendingNavigation.type === "reload") {
        window.location.reload();
      } else if (pendingNavigation.type === "exit") {
        // Can't force tab close, but this helps with programmatic navigation
        window.removeEventListener("beforeunload", handleBeforeUnload);
        window.history.go(pendingNavigation.delta || 0);
      }
      setPendingNavigation(null);
    }
  }, [cancelDialogOpen, pendingNavigation, navigate]);

  // Handle page leave/close events
  const handleBeforeUnload = useCallback(
    (e) => {
      if (!currentUser?.emailVerified) {
        // This displays the browser's default confirmation dialog
        e.preventDefault();
        e.returnValue =
          "Are you sure you want to leave? Your registration will be cancelled.";
        return e.returnValue;
      }
    },
    [currentUser]
  );

  // Set up beforeunload handler
  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [handleBeforeUnload]);

  // Block navigation with custom dialog
  useEffect(() => {
    // Save the original pushState and replaceState functions
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    // Override history methods to capture all navigation attempts
    window.history.pushState = function () {
      if (!currentUser?.emailVerified && !cancelDialogOpen) {
        setCancelDialogOpen(true);
        setPendingNavigation({ type: "navigate", to: arguments[2] });
        return;
      }
      return originalPushState.apply(this, arguments);
    };

    window.history.replaceState = function () {
      if (!currentUser?.emailVerified && !cancelDialogOpen) {
        setCancelDialogOpen(true);
        setPendingNavigation({ type: "navigate", to: arguments[2] });
        return;
      }
      return originalReplaceState.apply(this, arguments);
    };

    // Handle popstate events (back/forward buttons)
    const handlePopState = (e) => {
      if (!currentUser?.emailVerified && !cancelDialogOpen) {
        e.preventDefault();

        // Push the current state back to prevent navigation
        window.history.pushState(null, "", window.location.pathname);

        // Show the cancel dialog
        setCancelDialogOpen(true);
        setPendingNavigation({ type: "exit", delta: -1 });
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      // Restore original methods when component unmounts
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handlePopState);
    };
  }, [currentUser, cancelDialogOpen]);

  // Handle all link clicks
  useEffect(() => {
    const handleLinkClick = (e) => {
      // Only process anchor tags with href
      if (
        e.target.tagName === "A" &&
        e.target.href &&
        !e.target.href.includes(window.location.pathname) &&
        !currentUser?.emailVerified
      ) {
        e.preventDefault();
        e.stopPropagation();

        setCancelDialogOpen(true);
        setPendingNavigation({
          type: "navigate",
          to: e.target.href,
        });
      }
    };

    document.addEventListener("click", handleLinkClick, true);

    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [currentUser]);

  const handleResendVerification = async () => {
    try {
      setLoading(true);

      // If currentUser exists, use that to resend verification
      if (currentUser) {
        await sendEmailVerification(currentUser);
      } else {
        // Otherwise use the resendVerificationEmail function from context
        await resendVerificationEmail();
      }

      toast.success("Verification email sent successfully!");
      setCanResend(false);
      setTimer(60);
    } catch (error) {
      console.error("Error sending verification email:", error);
      toast.error("Failed to send verification email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRegistration = async () => {
    setCancelDialogOpen(true);
  };

  const confirmCancelRegistration = async () => {
    try {
      setIsProcessingCancel(true);
      await cancelRegistration();
      toast.info("Registration cancelled successfully");
      navigate("/login");
    } catch (error) {
      console.error("Error cancelling registration:", error);
      toast.error("Failed to cancel registration. Please try again.");
    } finally {
      setIsProcessingCancel(false);
      setCancelDialogOpen(false);
    }
  };

  const handleDialogClose = () => {
    if (!isProcessingCancel) {
      setCancelDialogOpen(false);
      setPendingNavigation(null);
    }
  };

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
            <MailOutlineIcon
              sx={{ fontSize: 64, color: "primary.main", mb: 2 }}
            />

            <Typography component="h1" variant="h4" gutterBottom align="center">
              Verify Your Email
            </Typography>

            <Typography variant="body1" align="center" paragraph>
              We've sent a verification email to:
            </Typography>

            <Typography
              variant="h6"
              color="primary"
              gutterBottom
              align="center"
            >
              {email}
            </Typography>

            <Typography variant="body1" align="center" sx={{ mt: 2 }} paragraph>
              Please check your inbox and click on the verification link to
              complete your registration. The link will expire in 24 hours.
            </Typography>

            <Alert severity="info" sx={{ mt: 2, mb: 3, width: "100%" }}>
              If you don't see the email, please check your spam folder.
            </Alert>

            <Button
              variant="contained"
              color="primary"
              disabled={loading || !canResend}
              onClick={handleResendVerification}
              sx={{ mt: 1, mb: 2 }}
              fullWidth
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : !canResend ? (
                `Resend Email (${timer}s)`
              ) : (
                "Resend Verification Email"
              )}
            </Button>

            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={handleCancelRegistration}
              sx={{ mt: 1, mb: 2 }}
              fullWidth
            >
              Cancel Registration
            </Button>
          </Paper>
        </motion.div>
      </Box>

      {/* Cancel Registration Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onClose={handleDialogClose}>
        <DialogTitle>Cancel Registration?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to cancel your registration? Your account will
            be permanently deleted and you'll need to register again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={isProcessingCancel}>
            No, Continue Registration
          </Button>
          <Button
            onClick={confirmCancelRegistration}
            color="error"
            disabled={isProcessingCancel}
          >
            {isProcessingCancel ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Yes, Cancel Registration"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default EmailVerification;
