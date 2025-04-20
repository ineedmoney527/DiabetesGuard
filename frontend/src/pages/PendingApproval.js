import React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Divider,
  Alert,
} from "@mui/material";
import { motion } from "framer-motion";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { useAuth } from "../contexts/AuthContext";

const PendingApproval = () => {
  const { currentUser } = useAuth();

  return (
    <Container component="main" maxWidth="md" sx={{ py: 8 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper elevation={3} sx={{ p: { xs: 3, md: 5 }, borderRadius: 2 }}>
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                mb: 3,
              }}
            >
              <Box
                sx={{
                  bgcolor: "warning.light",
                  color: "warning.contrastText",
                  borderRadius: "50%",
                  p: 2,
                  display: "flex",
                }}
              >
                <HourglassEmptyIcon sx={{ fontSize: 60 }} />
              </Box>
            </Box>

            <Typography variant="h4" gutterBottom fontWeight="bold">
              Account Pending Approval
            </Typography>

            <Typography variant="subtitle1" color="text.secondary" paragraph>
              Your healthcare provider account is awaiting administrator
              verification
            </Typography>

            <Divider sx={{ my: 3 }} />
          </Box>

          <Alert severity="info" sx={{ mb: 4 }}>
            Thank you for registering with Diabetick. As a healthcare provider,
            your account needs to be verified by an administrator before you can
            access patient data.
          </Alert>

          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              While you wait:
            </Typography>

            <Typography variant="body1" paragraph>
              • Your account information is being reviewed
            </Typography>

            <Typography variant="body1" paragraph>
              • You will receive an email notification once your account is
              approved
            </Typography>

            <Typography variant="body1" paragraph>
              • This verification process typically takes 1-2 business days
            </Typography>

            <Typography variant="body1" paragraph>
              • If you have any questions, please contact our support team
            </Typography>
          </Box>

          <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
            <Button
              component={RouterLink}
              to="/"
              variant="contained"
              color="primary"
              size="large"
              sx={{ minWidth: 200 }}
            >
              Return to Home
            </Button>
          </Box>
        </Paper>
      </motion.div>
    </Container>
  );
};

export default PendingApproval;
