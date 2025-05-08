import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Box,
  Card,
  CardContent,
  Slider,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { format, subDays } from "date-fns";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import NavBar from "../components/NavBar";
import html2canvas from "html2canvas";
import secureApi from "../utils/secureApi";
import { getAuth } from "firebase/auth";

const PatientDashboard = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [healthData, setHealthData] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });
  const [userData, setUserData] = useState({
    gender: "",
    birthdate: "",
    age: 0,
  });

  const [formData, setFormData] = useState({
    Pregnancies: 0,
    Glucose: 0,
    BloodPressure: 0,
    Insulin: 0,
    BMI: 0,
  });

  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);

  // Add refs for the charts
  const healthMetricsChartRef = useRef(null);
  const riskTrendChartRef = useRef(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (!currentUser) return; // Guard clause to prevent errors if currentUser is null

        // Use secureApi instead of direct axios call
        const response = await secureApi.get("/users/profile");

        const user = response.data;
        if (!user || !user.gender || !user.birthdate) {
          console.warn("Incomplete user data received:", user);
          setError("Profile data is incomplete. Please update your profile.");
          return;
        }

        setUserData({
          gender: user.gender,
          birthdate: user.birthdate,
          age: user.age || calculateAge(user.birthdate),
        });

        // If male, set pregnancies to 0 and disable the field
        if (user.gender === "male") {
          setFormData((prev) => ({ ...prev, Pregnancies: 0 }));
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setError("Failed to fetch user data. Please try again later.");
      }
    };

    if (currentUser) {
      // Only fetch data if user is logged in
      fetchUserData();
      fetchHealthData();
      fetchPrescriptions();
    }
  }, [currentUser]);

  const calculateAge = (birthdate) => {
    const birthDate = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  };

  const fetchHealthData = async () => {
    try {
      if (!currentUser) return; // Guard clause

      setHistoryLoading(true);

      const params = {
        startDate: format(dateRange.startDate, "yyyy-MM-dd"),
        endDate: format(dateRange.endDate, "yyyy-MM-dd"),
      };

      // Use secure API client for retrieving health data
      const response = await secureApi.get("/health/data/history", params);

      setHealthData(response.data);
    } catch (error) {
      console.error("Error fetching health data:", error);
      setError("Failed to fetch health history. Please try again later.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchPrescriptions = async () => {
    try {
      if (!currentUser) return;

      setPrescriptionsLoading(true);

      const params = {
        startDate: format(dateRange.startDate, "yyyy-MM-dd"),
        endDate: format(dateRange.endDate, "yyyy-MM-dd"),
      };

      console.log("Fetching prescriptions with params:", params);

      // Use secureApi instead of direct axios call
      const response = await secureApi.get("/health/prescriptions", params);

      console.log("Prescriptions API response:", response.data);
      setPrescriptions(response.data);
    } catch (error) {
      console.error("Error fetching prescriptions:", error);
      console.error("Error details:", error.response?.data || error.message);
    } finally {
      setPrescriptionsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0,
    }));
  };

  const handleSliderChange = (name) => (e, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!currentUser) {
        setError("You must be logged in to submit health data");
        return;
      }

      // Validate required data
      if (!userData.age) {
        setError(
          "Your profile is incomplete. Please update your profile with your birthdate first."
        );
        return;
      }

      setLoading(true);
      setError("");
      setSuccess("");

      // Make sure all values are valid numbers, not just objects with numeric properties
      const validatedFormData = {
        Pregnancies: Number(formData.Pregnancies),
        Glucose: Number(formData.Glucose),
        BloodPressure: Number(formData.BloodPressure),
        Insulin: Number(formData.Insulin),
        BMI: Number(formData.BMI),
        Age: Number(userData.age), // Include the user's age from profile data
      };

      console.log("Submitting health data with age:", validatedFormData.Age);

      // Use secureApi to submit the data
      const response = await secureApi.post("/health/data", validatedFormData);

      setPrediction(response.data.prediction);
      setSuccess("Health data saved successfully!");

      // Refresh health data history
      fetchHealthData();
    } catch (error) {
      console.error("Error submitting health data:", error);
      if (error.response?.data?.errors) {
        // Show more detailed validation errors if available
        const errorFields = error.response.data.errors
          .map((err) => err.path)
          .join(", ");
        setError(`Invalid data for: ${errorFields}. Please check your inputs.`);
      } else {
        setError("Failed to submit health data. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (field, value) => {
    setDateRange({
      ...dateRange,
      [field]: value,
    });
  };

  const handleFilterData = () => {
    fetchHealthData();
    fetchPrescriptions();
  };

  const generatePDF = async () => {
    try {
      setLoading(true);
      const doc = new jsPDF();

      // Add title
      doc.setFontSize(18);
      doc.text("Diabetes Health Report", 105, 15, { align: "center" });

      // Add user info
      doc.setFontSize(12);
      doc.text(`Patient: ${currentUser?.displayName || "N/A"}`, 20, 30);
      doc.text(
        `Date Range: ${format(dateRange.startDate, "MM/dd/yyyy")} - ${format(
          dateRange.endDate,
          "MM/dd/yyyy"
        )}`,
        20,
        40
      );

      // Add latest prediction if available
      let yOffset = 55;
      if (prediction) {
        doc.text("Latest Prediction:", 20, yOffset);

        // Set risk level color
        const riskColor = prediction.risk_level.toLowerCase().includes("low")
          ? "#4CAF50"
          : prediction.risk_level.toLowerCase().includes("medium")
          ? "#FF9800"
          : "#F44336";

        // Save the risk level text
        const riskLevelText = `Risk Level: ${prediction.risk_level}`;

        // First, draw white background to cover any existing text
        doc.setFillColor(255, 255, 255);
        const textWidth = doc.getTextWidth(riskLevelText);
        doc.rect(30, yOffset + 5, textWidth + 2, 10, "F");

        // Then draw colored text
        doc.setTextColor(
          hexToRgb(riskColor).r,
          hexToRgb(riskColor).g,
          hexToRgb(riskColor).b
        );
        doc.text(riskLevelText, 30, yOffset + 10);
        doc.setTextColor(0, 0, 0); // Reset to black

        doc.text(
          `Probability: ${(prediction.probability * 100).toFixed(2)}%`,
          30,
          yOffset + 20
        );
        yOffset += 30;
      } else if (healthData.length > 0 && healthData[0].prediction) {
        const latestPrediction = healthData[0].prediction;
        doc.text("Latest Prediction:", 20, yOffset);

        // Set risk level color
        const riskColor = latestPrediction.risk_level
          .toLowerCase()
          .includes("low")
          ? "#4CAF50"
          : latestPrediction.risk_level.toLowerCase().includes("medium")
          ? "#FF9800"
          : "#F44336";

        // Save the risk level text
        const riskLevelText = `Risk Level: ${latestPrediction.risk_level}`;

        // First, draw white background to cover any existing text
        doc.setFillColor(255, 255, 255);
        const textWidth = doc.getTextWidth(riskLevelText);
        doc.rect(30, yOffset + 5, textWidth + 2, 10, "F");

        // Then draw colored text
        doc.setTextColor(
          hexToRgb(riskColor).r,
          hexToRgb(riskColor).g,
          hexToRgb(riskColor).b
        );
        doc.text(riskLevelText, 30, yOffset + 10);
        doc.setTextColor(0, 0, 0); // Reset to black

        doc.text(
          `Probability: ${(latestPrediction.probability * 100).toFixed(2)}%`,
          30,
          yOffset + 20
        );
        yOffset += 30;
      }

      // Add table with health data
      if (healthData.length > 0) {
        // Add a table with historical data with colored values
        doc.autoTable({
          startY: yOffset,
          head: [
            [
              "Date",
              "Glucose",
              "Blood Pressure",
              "BMI",
              "Insulin",
              "Risk Level",
            ],
          ],
          body: healthData.map((record) => [
            record.timestamp
              ? format(new Date(record.timestamp), "MM/dd/yyyy")
              : "N/A",
            record.Glucose,
            record.BloodPressure,
            record.BMI,
            record.Insulin,
            record.prediction?.risk_level || "N/A",
          ]),
          didDrawCell: (data) => {
            // Check if it's a body cell (not header) and we need to color it
            if (data.section === "body") {
              const rowIndex = data.row.index;
              const colIndex = data.column.index;
              const record = healthData[rowIndex];

              // If record exists
              if (record) {
                let color = "#000000"; // Default black color

                // Set color based on column
                if (colIndex === 1 && record.Glucose) {
                  // Glucose column
                  color = getGlucoseColor(record.Glucose);
                } else if (colIndex === 2 && record.BloodPressure) {
                  // BP column
                  color = getBloodPressureColor(record.BloodPressure);
                } else if (colIndex === 3 && record.BMI) {
                  // BMI column
                  color = getBMIColor(record.BMI);
                } else if (colIndex === 4 && record.Insulin) {
                  // Insulin column
                  color = getInsulinColor(record.Insulin);
                } else if (colIndex === 5 && record.prediction?.risk_level) {
                  // Risk Level column
                  color = record.prediction.risk_level
                    .toLowerCase()
                    .includes("low")
                    ? "#4CAF50"
                    : record.prediction.risk_level
                        .toLowerCase()
                        .includes("medium")
                    ? "#FF9800"
                    : "#F44336";
                }

                // Only modify if we need to change color from default
                if (color !== "#000000" && color !== "inherit") {
                  // First, clear the existing text by drawing a white rectangle over the cell
                  doc.setFillColor(255, 255, 255);
                  doc.rect(
                    data.cell.x,
                    data.cell.y,
                    data.cell.width,
                    data.cell.height,
                    "F"
                  );

                  // Now draw the colored text
                  const rgb = hexToRgb(color);
                  doc.setTextColor(rgb.r, rgb.g, rgb.b);
                  doc.text(
                    data.cell.text,
                    data.cell.x + data.cell.padding("left"),
                    data.cell.y + data.cell.height / 2 + 1
                  );
                  doc.setTextColor(0, 0, 0); // Reset to black
                }
              }
            }
          },
        });

        yOffset = doc.lastAutoTable.finalY + 10;
      } else {
        doc.text("No health data available for this period.", 20, yOffset);
        yOffset += 10;
      }

      // Capture and add health metrics chart if it exists and has data
      if (healthMetricsChartRef.current && chartData.length > 0) {
        doc.addPage();
        yOffset = 20;
        doc.text("Health Metrics Trends", 105, yOffset, { align: "center" });
        yOffset += 10;

        const healthMetricsCanvas = await html2canvas(
          healthMetricsChartRef.current
        );
        const healthMetricsImgData = healthMetricsCanvas.toDataURL("image/png");
        doc.addImage(healthMetricsImgData, "PNG", 15, yOffset, 180, 80);
      }

      // Capture and add risk trend chart if it exists and has data
      if (
        riskTrendChartRef.current &&
        chartData.some((data) => data.diabetesRisk > 0)
      ) {
        doc.addPage();
        yOffset = 20;
        doc.text("Diabetes Risk Prediction Trend", 105, yOffset, {
          align: "center",
        });
        yOffset += 10;

        const riskTrendCanvas = await html2canvas(riskTrendChartRef.current);
        const riskTrendImgData = riskTrendCanvas.toDataURL("image/png");
        doc.addImage(riskTrendImgData, "PNG", 15, yOffset, 180, 80);
      }

      // Save the PDF
      doc.save(`diabetes_report_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      setError("Failed to generate PDF report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert hex color to RGB
  const hexToRgb = (hex) => {
    // Default to black if hex is inherit or undefined
    if (!hex || hex === "inherit") return { r: 0, g: 0, b: 0 };

    // Remove the # if present
    hex = hex.replace("#", "");

    // Convert 3-digit hex to 6-digit
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  };

  // Helper functions for color-coding health metrics
  const getGlucoseColor = (value) => {
    if (!value) return "inherit";
    if (value > 180) return "#d32f2f"; // Danger - red
    if (value > 140) return "#ff9800"; // Warning - orange
    if (value < 70) return "#ff9800"; // Warning - orange
    return "#2e7d32"; // Normal - green
  };

  const getBloodPressureColor = (value) => {
    if (!value) return "inherit";

    // Check if value is a string and contains a slash
    if (typeof value === "string" && value.includes("/")) {
      try {
        const [systolic, diastolic] = value
          .split("/")
          .map((v) => parseInt(v.trim()));

        if (systolic > 140 || diastolic > 90) return "#d32f2f"; // Hypertension - red
        if (
          (systolic >= 130 && systolic <= 139) ||
          (diastolic >= 80 && diastolic <= 89)
        )
          return "#ff9800"; // Elevated - orange
        return "#2e7d32"; // Normal - green
      } catch (error) {
        console.warn("Invalid blood pressure format:", value);
        return "inherit";
      }
    } else {
      // Handle numeric values or other formats
      const numValue = Number(value);
      if (isNaN(numValue)) return "inherit";

      if (numValue > 140) return "#d32f2f"; // Treating as systolic - red
      if (numValue >= 130) return "#ff9800"; // Elevated - orange
      if (numValue < 90) return "#2e7d32"; // Normal - green
      return "#2e7d32"; // Default to normal
    }
  };

  const getBMIColor = (value) => {
    if (!value) return "inherit";
    if (value > 30) return "#d32f2f"; // Obese - red
    if (value >= 25) return "#ff9800"; // Overweight - orange
    if (value < 18.5) return "#ff9800"; // Underweight - orange
    return "#2e7d32"; // Normal - green
  };

  const getInsulinColor = (value) => {
    if (!value) return "inherit";
    if (value > 25) return "#ff9800"; // High - orange
    if (value < 3) return "#ff9800"; // Low - orange
    return "#2e7d32"; // Normal - green
  };

  // Chart data
  const chartData = healthData
    .map((record) => {
      try {
        // Skip any records missing critical fields
        if (
          !record ||
          !record.Glucose ||
          !record.BloodPressure ||
          !record.BMI ||
          !record.Insulin
        ) {
          console.warn("Skipping incomplete health record:", record?.id);
          return null;
        }

        return {
          date: record.timestamp
            ? format(new Date(record.timestamp), "MM/dd")
            : "Unknown",
          glucose: record.Glucose || 0,
          bmi: record.BMI || 0,
          insulin: record.Insulin || 0,
          bloodPressure: record.BloodPressure || 0,
          glucoseColor: getGlucoseColor(record.Glucose || 0),
          bmiColor: getBMIColor(record.BMI || 0),
          insulinColor: getInsulinColor(record.Insulin || 0),
          bpColor: getBloodPressureColor(record.BloodPressure || ""),
          diabetesRisk: record.prediction
            ? record.prediction.probability * 100
            : 0,
          riskLevel: record.prediction ? record.prediction.risk_level : "N/A",
        };
      } catch (error) {
        console.error("Error processing health record for chart:", error);
        return null;
      }
    })
    .filter(Boolean) // Remove any null items
    .reverse();

  // Function to get color for risk level
  const getRiskColor = (riskLevel) => {
    if (riskLevel === "Low Risk") return "#4CAF50";
    if (riskLevel === "Medium Risk") return "#FF9800";
    return "#F44336";
  };

  // Return null if user is not authenticated
  // This helps prevent rendering components that depend on currentUser before it's available
  if (!currentUser) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" component="h2" gutterBottom align="center">
            Please log in to access the Patient Dashboard
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <>
      <NavBar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          {/* Health Data Input Form */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: "100%" }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Input Health Data
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {success}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  {/* Pregnancies */}
                  <Grid item xs={12}>
                    <TextField
                      label="Pregnancies"
                      name="Pregnancies"
                      type="number"
                      value={formData.Pregnancies}
                      onChange={handleInputChange}
                      fullWidth
                      InputProps={{
                        inputProps: { min: 0 },
                        disabled: userData.gender === "male",
                      }}
                      helperText={
                        userData.gender === "male"
                          ? "Automatically set to 0 for male patients"
                          : ""
                      }
                    />
                  </Grid>

                  {/* Glucose */}
                  <Grid item xs={12}>
                    <Typography gutterBottom>
                      Glucose (mg/dL): {formData.Glucose}
                    </Typography>
                    <Slider
                      value={formData.Glucose}
                      onChange={handleSliderChange("Glucose")}
                      min={0}
                      max={300}
                      step={1}
                      valueLabelDisplay="auto"
                      sx={{
                        "& .MuiSlider-thumb": {
                          color: getGlucoseColor(formData.Glucose),
                        },
                        "& .MuiSlider-track": {
                          color: getGlucoseColor(formData.Glucose),
                        },
                      }}
                    />
                  </Grid>

                  {/* Blood Pressure */}
                  <Grid item xs={12}>
                    <Typography gutterBottom>
                      Blood Pressure (mm Hg): {formData.BloodPressure}
                    </Typography>
                    <Slider
                      value={formData.BloodPressure}
                      onChange={handleSliderChange("BloodPressure")}
                      min={0}
                      max={200}
                      step={1}
                      valueLabelDisplay="auto"
                      sx={{
                        "& .MuiSlider-thumb": {
                          color: getBloodPressureColor(formData.BloodPressure),
                        },
                        "& .MuiSlider-track": {
                          color: getBloodPressureColor(formData.BloodPressure),
                        },
                      }}
                    />
                  </Grid>

                  {/* Insulin */}
                  <Grid item xs={12}>
                    <Typography gutterBottom>
                      Insulin (mu U/ml): {formData.Insulin}
                    </Typography>
                    <Slider
                      value={formData.Insulin}
                      onChange={handleSliderChange("Insulin")}
                      min={0}
                      max={300}
                      step={1}
                      valueLabelDisplay="auto"
                      sx={{
                        "& .MuiSlider-thumb": {
                          color: getInsulinColor(formData.Insulin),
                        },
                        "& .MuiSlider-track": {
                          color: getInsulinColor(formData.Insulin),
                        },
                      }}
                    />
                  </Grid>

                  {/* BMI */}
                  <Grid item xs={12}>
                    <Typography gutterBottom>BMI: {formData.BMI}</Typography>
                    <Slider
                      value={formData.BMI}
                      onChange={handleSliderChange("BMI")}
                      min={0}
                      max={60}
                      step={0.1}
                      valueLabelDisplay="auto"
                      sx={{
                        "& .MuiSlider-thumb": {
                          color: getBMIColor(formData.BMI),
                        },
                        "& .MuiSlider-track": {
                          color: getBMIColor(formData.BMI),
                        },
                      }}
                    />
                  </Grid>

                  {/* Age - Readonly, calculated from birthdate */}
                  <Grid item xs={12}>
                    <TextField
                      label="Age"
                      value={userData.age}
                      fullWidth
                      InputProps={{ readOnly: true }}
                      helperText="Calculated from your birthdate"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      fullWidth
                      disabled={loading}
                    >
                      {loading ? (
                        <CircularProgress size={24} />
                      ) : (
                        "Submit Health Data"
                      )}
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </Paper>
          </Grid>

          {/* Prediction Results */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={3}
              sx={{ p: 3, mb: 3, height: "calc(50% - 12px)" }}
            >
              <Typography variant="h5" component="h2" gutterBottom>
                Diabetes Risk Prediction
              </Typography>

              {prediction ? (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "80%",
                  }}
                >
                  <Typography
                    variant="h4"
                    component="div"
                    align="center"
                    gutterBottom
                    sx={{
                      color:
                        prediction.risk_level === "Low Risk"
                          ? "success.main"
                          : prediction.risk_level === "Medium Risk"
                          ? "warning.main"
                          : "error.main",
                    }}
                  >
                    {prediction.risk_level}
                  </Typography>

                  <Typography variant="body1" align="center">
                    Probability: {(prediction.probability * 100).toFixed(2)}%
                  </Typography>

                  <Box sx={{ width: "100%", mt: 2 }}>
                    <Typography variant="body2" align="center" gutterBottom>
                      {prediction.risk_level === "Low Risk"
                        ? "Your current risk is low. Keep maintaining healthy habits!"
                        : prediction.risk_level === "Medium Risk"
                        ? "You have a moderate risk. Consider lifestyle modifications."
                        : "Your risk is high. Please consult with your doctor soon."}
                    </Typography>
                  </Box>
                </Box>
              ) : healthData.length > 0 && healthData[0].prediction ? (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "80%",
                  }}
                >
                  <Typography variant="h6" component="div" gutterBottom>
                    Latest Prediction:
                  </Typography>
                  <Typography
                    variant="h4"
                    component="div"
                    align="center"
                    gutterBottom
                    sx={{
                      color:
                        healthData[0].prediction.risk_level === "Low Risk"
                          ? "success.main"
                          : healthData[0].prediction.risk_level ===
                            "Medium Risk"
                          ? "warning.main"
                          : "error.main",
                    }}
                  >
                    {healthData[0].prediction.risk_level}
                  </Typography>

                  <Typography variant="body1" align="center">
                    Probability:{" "}
                    {(healthData[0].prediction.probability * 100).toFixed(2)}%
                  </Typography>

                  <Typography variant="caption" align="center" sx={{ mt: 1 }}>
                    From{" "}
                    {healthData[0].timestamp
                      ? format(
                          new Date(healthData[0].timestamp),
                          "MMM dd, yyyy"
                        )
                      : "unknown date"}
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "80%",
                  }}
                >
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    align="center"
                  >
                    Submit your health data to get a diabetes risk prediction
                  </Typography>
                </Box>
              )}
            </Paper>

            <Paper elevation={3} sx={{ p: 3, height: "calc(50% - 12px)" }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h5" component="h2" gutterBottom>
                  Health Report
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={generatePDF}
                  disabled={healthData.length === 0}
                >
                  Download PDF
                </Button>
              </Box>

              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={5}>
                    <DatePicker
                      label="Start Date"
                      value={dateRange.startDate}
                      onChange={(newValue) =>
                        handleDateRangeChange("startDate", newValue)
                      }
                      slotProps={{
                        textField: { fullWidth: true, size: "small" },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={5}>
                    <DatePicker
                      label="End Date"
                      value={dateRange.endDate}
                      onChange={(newValue) =>
                        handleDateRangeChange("endDate", newValue)
                      }
                      slotProps={{
                        textField: { fullWidth: true, size: "small" },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <Button
                      variant="outlined"
                      onClick={handleFilterData}
                      fullWidth
                      sx={{ height: "100%" }}
                    >
                      Filter
                    </Button>
                  </Grid>
                </Grid>
              </LocalizationProvider>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ height: "150px", overflow: "auto" }}>
                {historyLoading ? (
                  <Box
                    sx={{ display: "flex", justifyContent: "center", py: 2 }}
                  >
                    <CircularProgress size={30} />
                  </Box>
                ) : healthData.length > 0 ? (
                  healthData.slice(0, 5).map((record, index) => (
                    <Card key={index} variant="outlined" sx={{ mb: 1 }}>
                      <CardContent sx={{ py: 1, "&:last-child": { pb: 1 } }}>
                        <Grid container>
                          <Grid item xs={4}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {record.timestamp
                                ? format(
                                    new Date(record.timestamp),
                                    "MMM dd, yyyy"
                                  )
                                : "Unknown"}
                            </Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="body2">
                              Glucose:{" "}
                              <span
                                style={{
                                  color: getGlucoseColor(record.Glucose),
                                }}
                              >
                                {record.Glucose}
                              </span>
                            </Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography
                              variant="body2"
                              sx={{
                                color:
                                  record.prediction?.risk_level === "Low Risk"
                                    ? "success.main"
                                    : record.prediction?.risk_level ===
                                      "Medium Risk"
                                    ? "warning.main"
                                    : "error.main",
                              }}
                            >
                              {record.prediction?.risk_level || "N/A"}
                            </Typography>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    align="center"
                  >
                    No health data available for this period
                  </Typography>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Trend Charts */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Health Metrics Trends
              </Typography>

              {healthData.length > 0 ? (
                <Box
                  sx={{ height: 400, width: "100%" }}
                  ref={healthMetricsChartRef}
                >
                  {chartData && chartData.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="glucose"
                          name="Glucose (mg/dL)"
                          stroke="#8884d8"
                          activeDot={{ r: 8 }}
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="bmi"
                          name="BMI"
                          stroke="#82ca9d"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="insulin"
                          name="Insulin (μU/mL)"
                          stroke="#ff7300"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="bloodPressure"
                          name="Blood Pressure (mm Hg)"
                          stroke="#0088FE"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 200,
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    No data available to display trends
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Prediction Trend Chart */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Diabetes Risk Prediction Trend
              </Typography>

              {healthData.length > 0 ? (
                <Box
                  sx={{ height: 400, width: "100%" }}
                  ref={riskTrendChartRef}
                >
                  {chartData &&
                  chartData.length > 0 &&
                  chartData.some((data) => data.diabetesRisk > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            `${value.toFixed(2)}%`,
                            "Diabetes Risk",
                          ]}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="diabetesRisk"
                          name="Diabetes Risk"
                          stroke="#e91e63"
                          activeDot={{ r: 8 }}
                          strokeWidth={3}
                          dot={{
                            stroke: "#e91e63",
                            strokeWidth: 2,
                            r: 4,
                            fill: (entry) => getRiskColor(entry.riskLevel),
                          }}
                        />
                        <ReferenceLine
                          y={30}
                          stroke="#4CAF50"
                          strokeDasharray="3 3"
                          label="Low Risk Threshold"
                        />
                        <ReferenceLine
                          y={70}
                          stroke="#F44336"
                          strokeDasharray="3 3"
                          label="High Risk Threshold"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: 200,
                      }}
                    >
                      <Typography variant="body1" color="text.secondary">
                        No prediction data available
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 200,
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    No data available to display risk trends
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Prescriptions & Suggestions */}
          <Grid item xs={12}>
            <Paper
              sx={{
                p: 2,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Typography variant="h6" gutterBottom component="div">
                Prescriptions & Suggestions
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {prescriptionsLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : prescriptions.length > 0 ? (
                <List>
                  {prescriptions.map((prescription) => (
                    <React.Fragment key={prescription.id}>
                      <ListItem alignItems="flex-start">
                        <ListItemText
                          primary={
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <Typography variant="subtitle1">
                                {format(
                                  new Date(prescription.timestamp),
                                  "MMMM dd, yyyy"
                                )}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Dr. {prescription.doctorName}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <>
                              {prescription.suggestion && (
                                <Box sx={{ mt: 1, mb: 2 }}>
                                  <Typography
                                    variant="subtitle2"
                                    component="span"
                                    color="primary"
                                  >
                                    Suggestion:
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    component="p"
                                    sx={{ mt: 0.5 }}
                                  >
                                    {prescription.suggestion}
                                  </Typography>
                                </Box>
                              )}

                              <Typography
                                variant="subtitle2"
                                component="span"
                                color="primary"
                              >
                                Medicines:
                              </Typography>

                              {prescription.medicines.map((medicine, index) => (
                                <Box key={index} sx={{ mt: 1, ml: 2, mb: 1 }}>
                                  <Typography
                                    variant="body2"
                                    component="p"
                                    fontWeight="bold"
                                  >
                                    {medicine.name}
                                  </Typography>
                                  <Typography variant="body2" component="p">
                                    Dosage: {medicine.dosage} | Frequency:{" "}
                                    {medicine.frequency} | Duration:{" "}
                                    {medicine.duration}
                                  </Typography>
                                  {medicine.specialInstructions && (
                                    <Typography
                                      variant="body2"
                                      component="p"
                                      color="text.secondary"
                                    >
                                      Special instructions:{" "}
                                      {medicine.specialInstructions}
                                    </Typography>
                                  )}
                                </Box>
                              ))}
                            </>
                          }
                        />
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ py: 2, textAlign: "center" }}
                  >
                    No prescriptions or suggestions have been given yet.
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={fetchPrescriptions}
                    sx={{ mt: 1 }}
                  >
                    Refresh Prescriptions
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </>
  );
};

export default PatientDashboard;
