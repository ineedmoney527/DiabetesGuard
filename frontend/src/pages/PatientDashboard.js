import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (!currentUser) return; // Guard clause to prevent errors if currentUser is null

        const token = await currentUser.getIdToken();

        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/users/profile`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const user = response.data;
        setUserData({
          gender: user.gender,
          birthdate: user.birthdate,
          age: calculateAge(user.birthdate),
        });

        // If male, set pregnancies to 0 and disable the field
        if (user.gender === "male") {
          setFormData((prev) => ({ ...prev, Pregnancies: 0 }));
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    if (currentUser) {
      // Only fetch data if user is logged in
      fetchUserData();
      fetchHealthData();
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
      const token = await currentUser.getIdToken();

      const params = {
        startDate: format(dateRange.startDate, "yyyy-MM-dd"),
        endDate: format(dateRange.endDate, "yyyy-MM-dd"),
      };

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/health/data/history`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }
      );

      setHealthData(response.data);
    } catch (error) {
      console.error("Error fetching health data:", error);
      setError("Failed to fetch health history. Please try again later.");
    } finally {
      setHistoryLoading(false);
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

      setLoading(true);
      setError("");
      setSuccess("");

      const token = await currentUser.getIdToken();

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/health/data`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPrediction(response.data.prediction);
      setSuccess("Health data saved successfully!");

      // Refresh health data history
      fetchHealthData();
    } catch (error) {
      console.error("Error submitting health data:", error);
      setError("Failed to submit health data. Please try again.");
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
  };

  const generatePDF = () => {
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
    if (prediction) {
      doc.text("Latest Prediction:", 20, 55);
      doc.text(`Risk Level: ${prediction.risk_level}`, 30, 65);
      doc.text(
        `Probability: ${(prediction.probability * 100).toFixed(2)}%`,
        30,
        75
      );
    } else if (healthData.length > 0 && healthData[0].prediction) {
      const latestPrediction = healthData[0].prediction;
      doc.text("Latest Prediction:", 20, 55);
      doc.text(`Risk Level: ${latestPrediction.risk_level}`, 30, 65);
      doc.text(
        `Probability: ${(latestPrediction.probability * 100).toFixed(2)}%`,
        30,
        75
      );
    }

    // Add table with health data
    if (healthData.length > 0) {
      const tableData = healthData.map((record) => [
        record.timestamp
          ? format(new Date(record.timestamp), "MM/dd/yyyy")
          : "N/A",
        record.Glucose,
        record.BloodPressure,
        record.BMI,
        record.Insulin,
        record.prediction?.risk_level || "N/A",
      ]);

      doc.autoTable({
        startY: 90,
        head: [
          ["Date", "Glucose", "Blood Pressure", "BMI", "Insulin", "Risk Level"],
        ],
        body: tableData,
      });
    } else {
      doc.text("No health data available for this period.", 20, 90);
    }

    // Save the PDF
    doc.save(`diabetes_report_${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  // Get colors for charts based on value ranges
  const getGlucoseColor = (value) => {
    if (value < 70) return "#3F51B5"; // Low (hypoglycemia)
    if (value <= 99) return "#4CAF50"; // Normal
    if (value <= 125) return "#FF9800"; // Prediabetes
    return "#F44336"; // Diabetes
  };

  const getBMIColor = (value) => {
    if (value < 18.5) return "#3F51B5"; // Underweight
    if (value < 25) return "#4CAF50"; // Normal
    if (value < 30) return "#FF9800"; // Overweight
    return "#F44336"; // Obese
  };

  const getInsulinColor = (value) => {
    if (value < 3) return "#3F51B5"; // Low
    if (value <= 25) return "#4CAF50"; // Normal
    return "#F44336"; // High
  };

  const getBPColor = (value) => {
    if (value < 90) return "#3F51B5"; // Low
    if (value <= 120) return "#4CAF50"; // Normal
    if (value <= 140) return "#FF9800"; // Elevated/Stage 1
    return "#F44336"; // Stage 2 hypertension
  };

  // Chart data
  const chartData = healthData
    .map((record) => ({
      date: record.timestamp
        ? format(new Date(record.timestamp), "MM/dd")
        : "Unknown",
      glucose: record.Glucose,
      bmi: record.BMI,
      insulin: record.Insulin,
      bloodPressure: record.BloodPressure,
      glucoseColor: getGlucoseColor(record.Glucose),
      bmiColor: getBMIColor(record.BMI),
      insulinColor: getInsulinColor(record.Insulin),
      bpColor: getBPColor(record.BloodPressure),
      diabetesRisk: record.prediction ? record.prediction.probability * 100 : 0,
      riskLevel: record.prediction ? record.prediction.risk_level : "N/A",
    }))
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
                          color: getBPColor(formData.BloodPressure),
                        },
                        "& .MuiSlider-track": {
                          color: getBPColor(formData.BloodPressure),
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
                              Glucose: {record.Glucose}
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
                <Box sx={{ height: 400, width: "100%" }}>
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
                <Box sx={{ height: 400, width: "100%" }}>
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
        </Grid>
      </Container>
    </>
  );
};

export default PatientDashboard;
