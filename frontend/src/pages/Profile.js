import React, { useState, useEffect } from "react";
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { useAuth } from "../contexts/AuthContext";
import NavBar from "../components/NavBar";
import secureApi from "../utils/secureApi";

const Profile = () => {
  const { currentUser, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [userProfile, setUserProfile] = useState({
    name: "",
    email: "",
    birthdate: null,
    gender: "",
    mfaEnabled: false,
    age: 0,
  });

  // MFA setup states
  const [openMfaSetup, setOpenMfaSetup] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState("");

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);

        // Use secureApi instead of direct axios call
        const response = await secureApi.get("/users/profile");

        const userData = response.data;

        // Check if userData has valid properties
        if (
          !userData ||
          (!userData.name && !userData.gender && !userData.birthdate)
        ) {
          console.warn("Received incomplete user data:", userData);
          setError(
            "Your profile data appears to be incomplete. Try updating your profile."
          );
        }

        setUserProfile({
          name: userData.name || "",
          email: userData.email || "",
          birthdate: userData.birthdate ? new Date(userData.birthdate) : null,
          gender: userData.gender || "",
          mfaEnabled: userData.mfaEnabled || false,
          age: userData.age || 0,
        });

        // Also fetch MFA status
        const mfaResponse = await secureApi.get("/auth/mfa/status");

        setUserProfile((prev) => ({
          ...prev,
          mfaEnabled: mfaResponse.data.mfaEnabled,
        }));
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setError("Failed to load user profile. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchUserProfile();
    }
  }, [currentUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDateChange = (date) => {
    setUserProfile((prev) => ({
      ...prev,
      birthdate: date,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // Only send fields that are editable
      const updatedData = {
        name: userProfile.name,
        gender: userProfile.gender,
        birthdate: userProfile.birthdate
          ? userProfile.birthdate.toISOString().split("T")[0]
          : null,
      };

      // Use secureApi instead of direct axios call
      const response = await secureApi.put("/users/profile", updatedData);

      // If the server returns the updated profile, use it to update the UI
      if (response.data.updatedProfile) {
        const { name, gender, birthdate, age } = response.data.updatedProfile;
        setUserProfile((prevState) => ({
          ...prevState,
          name,
          gender,
          birthdate: new Date(birthdate),
          age: age || prevState.age,
        }));
      }

      setSuccess("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      setError("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // MFA setup handlers
  const handleMfaSetupOpen = async () => {
    try {
      setMfaLoading(true);
      setMfaError("");

      // Use secureApi instead of direct axios call
      const response = await secureApi.post("/auth/mfa/setup");

      setMfaQrCode(response.data.qrCode);
      setMfaSecret(response.data.secret);
      setOpenMfaSetup(true);
    } catch (error) {
      console.error("Error setting up MFA:", error);
      setMfaError("Failed to set up MFA. Please try again.");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaSetupClose = () => {
    setOpenMfaSetup(false);
    setVerificationCode("");
    setMfaError("");
  };

  const handleVerificationCodeChange = (e) => {
    setVerificationCode(e.target.value);
  };

  const handleVerifyAndEnableMfa = async () => {
    try {
      setMfaLoading(true);
      setMfaError("");

      // Use secureApi instead of direct axios call
      await secureApi.post("/auth/mfa/verify", {
        secret: mfaSecret,
        token: verificationCode,
      });

      // Update local state
      setUserProfile((prev) => ({
        ...prev,
        mfaEnabled: true,
      }));

      // Close the dialog
      setOpenMfaSetup(false);
      setSuccess("Two-factor authentication enabled successfully!");
    } catch (error) {
      console.error("Error verifying MFA code:", error);
      setMfaError("Invalid verification code. Please try again.");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    try {
      setMfaLoading(true);

      // Use secureApi instead of direct axios call
      await secureApi.post("/auth/mfa/disable");

      // Update local state
      setUserProfile((prev) => ({
        ...prev,
        mfaEnabled: false,
      }));

      setSuccess("Two-factor authentication disabled successfully.");
    } catch (error) {
      console.error("Error disabling MFA:", error);
      setError("Failed to disable MFA. Please try again.");
    } finally {
      setMfaLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <NavBar />
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "60vh",
            }}
          >
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Profile
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Update your personal information
          </Typography>

          <Divider sx={{ my: 3 }} />

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {success}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="Name"
                  name="name"
                  value={userProfile.name}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Email"
                  name="email"
                  value={userProfile.email}
                  fullWidth
                  InputProps={{ readOnly: true }}
                  helperText="Email cannot be changed"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Birth Date"
                    value={userProfile.birthdate}
                    onChange={handleDateChange}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        required: true,
                      },
                    }}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel id="gender-label">Gender</InputLabel>
                  <Select
                    labelId="gender-label"
                    id="gender"
                    name="gender"
                    value={userProfile.gender}
                    onChange={handleInputChange}
                    label="Gender"
                  >
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Age"
                  value={userProfile.age || "Not calculated"}
                  fullWidth
                  InputProps={{ readOnly: true }}
                  helperText="Calculated from your birth date"
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ mt: 2, mb: 2 }}>
                  <Divider>
                    <Typography variant="subtitle1">
                      Security Settings
                    </Typography>
                  </Divider>
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mt: 2,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle1">
                      Two-Factor Authentication (2FA)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {userProfile.mfaEnabled
                        ? "Your account is protected with two-factor authentication"
                        : "Add an extra layer of security to your account"}
                    </Typography>
                  </Box>
                  <Box>
                    {userProfile.mfaEnabled ? (
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={handleDisableMfa}
                        disabled={mfaLoading}
                      >
                        {mfaLoading ? (
                          <CircularProgress size={24} />
                        ) : (
                          "Disable 2FA"
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleMfaSetupOpen}
                        disabled={mfaLoading}
                      >
                        {mfaLoading ? (
                          <CircularProgress size={24} />
                        ) : (
                          "Set Up MFA"
                        )}
                      </Button>
                    )}
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box
                  sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}
                >
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={saving}
                    sx={{ minWidth: 120 }}
                  >
                    {saving ? <CircularProgress size={24} /> : "Save Changes"}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>

          {/* MFA Setup Dialog */}
          <Dialog
            open={openMfaSetup}
            onClose={handleMfaSetupClose}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Two-factor authentication adds an extra layer of security to
                your account. When enabled, you'll need to provide a
                verification code from your authenticator app in addition to
                your password when signing in.
              </DialogContentText>

              {mfaError && (
                <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                  {mfaError}
                </Alert>
              )}

              <Box sx={{ my: 3, textAlign: "center" }}>
                <Typography variant="subtitle1" gutterBottom>
                  1. Scan this QR code with your authenticator app
                </Typography>
                {mfaQrCode && (
                  <Box
                    sx={{ display: "flex", justifyContent: "center", mb: 2 }}
                  >
                    <img
                      src={mfaQrCode}
                      alt="TOTP QR Code"
                      width="200"
                      height="200"
                    />
                  </Box>
                )}
                <Typography variant="body2" color="text.secondary">
                  Recommended apps: Google Authenticator, Microsoft
                  Authenticator, Authy
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  2. Manual setup - if you can't scan the QR code
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Enter this key manually in your authenticator app:
                </Typography>
                <TextField
                  value={mfaSecret}
                  fullWidth
                  variant="outlined"
                  margin="dense"
                  InputProps={{
                    readOnly: true,
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  3. Enter the verification code from your app
                </Typography>
                <TextField
                  label="6-digit verification code"
                  value={verificationCode}
                  onChange={handleVerificationCodeChange}
                  fullWidth
                  required
                  variant="outlined"
                  margin="dense"
                  inputProps={{ maxLength: 6 }}
                  placeholder="000000"
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleMfaSetupClose}>Cancel</Button>
              <Button
                onClick={handleVerifyAndEnableMfa}
                variant="contained"
                color="primary"
                disabled={verificationCode.length !== 6 || mfaLoading}
              >
                {mfaLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  "Verify & Enable"
                )}
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Container>
    </>
  );
};

export default Profile;
