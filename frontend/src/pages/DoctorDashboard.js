import React, { useState, useEffect } from "react";
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Chip,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
} from "@mui/material";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
} from "recharts";
import { format, subDays, differenceInYears } from "date-fns";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import NavBar from "../components/NavBar";

const HealthProfessionalDashboard = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [aggregateStats, setAggregateStats] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeHealthData, setEmployeeHealthData] = useState([]);
  const [currentTab, setCurrentTab] = useState(0);
  const [filters, setFilters] = useState({
    ageGroup: "all",
    gender: "all",
    riskLevel: "all",
    position: "all",
  });
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });
  const [showStatusWarning, setShowStatusWarning] = useState(false);
  const [accessStatus, setAccessStatus] = useState("active");
  const [employeeDetailsOpen, setEmployeeDetailsOpen] = useState(false);
  const [aggregateHealthTrends, setAggregateHealthTrends] = useState([]);
  const [aggregateRiskTrends, setAggregateRiskTrends] = useState([]);

  // Fetch employees on component mount
  useEffect(() => {
    fetchEmployees();
    fetchAggregateStats();
    fetchAggregateHealthTrends();
    fetchAggregateRiskTrends();
  }, [currentUser]);

  // Fetch employee health data when an employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeHealthData(selectedEmployee.id);
    }
  }, [selectedEmployee, dateRange]);

  // Fetch aggregate trends when filters change
  useEffect(() => {
    fetchAggregateHealthTrends();
    fetchAggregateRiskTrends();
  }, [filters, dateRange]);

  const handleCloseStatusWarning = () => {
    setShowStatusWarning(false);
  };

  const handleCloseEmployeeDetails = () => {
    setEmployeeDetailsOpen(false);
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const token = await currentUser.getIdToken();

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/users/patients`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setEmployees(response.data);
      // If we successfully get employees, the health professional is likely active
    } catch (error) {
      console.error("Error fetching employees:", error);

      // Check if there was a 403 error which could indicate a pending or inactive status
      if (error.response && error.response.status === 403) {
        setAccessStatus("inactive");
        setShowStatusWarning(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAggregateStats = async () => {
    try {
      const token = await currentUser.getIdToken();

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/health/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAggregateStats(response.data);
    } catch (error) {
      console.error("Error fetching aggregate stats:", error);

      // Check if there was a 403 error which could indicate a pending or inactive status
      if (error.response && error.response.status === 403) {
        setAccessStatus("inactive");
        setShowStatusWarning(true);
      }
    }
  };

  const fetchEmployeeHealthData = async (employeeId) => {
    try {
      setLoading(true);
      const token = await currentUser.getIdToken();

      const params = {
        startDate: format(dateRange.startDate, "yyyy-MM-dd"),
        endDate: format(dateRange.endDate, "yyyy-MM-dd"),
      };

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/health/patients/${employeeId}/data`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }
      );

      setEmployeeHealthData(response.data);
    } catch (error) {
      console.error("Error fetching employee health data:", error);

      // Check if there was a 403 error which could indicate a pending or inactive status
      if (error.response && error.response.status === 403) {
        setAccessStatus("inactive");
        setShowStatusWarning(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch aggregate health trends data
  const fetchAggregateHealthTrends = async () => {
    try {
      const token = await currentUser.getIdToken();

      const params = {
        startDate: format(dateRange.startDate, "yyyy-MM-dd"),
        endDate: format(dateRange.endDate, "yyyy-MM-dd"),
        ageGroup: filters.ageGroup,
        gender: filters.gender,
        position: filters.position,
      };

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/health/aggregate/trends`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }
      );

      setAggregateHealthTrends(response.data);
    } catch (error) {
      console.error("Error fetching aggregate health trends:", error);
    }
  };

  // Fetch aggregate risk trends data
  const fetchAggregateRiskTrends = async () => {
    try {
      const token = await currentUser.getIdToken();

      const params = {
        startDate: format(dateRange.startDate, "yyyy-MM-dd"),
        endDate: format(dateRange.endDate, "yyyy-MM-dd"),
        ageGroup: filters.ageGroup,
        gender: filters.gender,
        position: filters.position,
      };

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/health/aggregate/risk`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }
      );

      setAggregateRiskTrends(response.data);
    } catch (error) {
      console.error("Error fetching aggregate risk trends:", error);
    }
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    setEmployeeDetailsOpen(true);
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters({
      ...filters,
      [name]: value,
    });
  };

  const handleDateRangeChange = (field, value) => {
    setDateRange({
      ...dateRange,
      [field]: value,
    });
  };

  // Filter employees based on selected filters
  const filteredEmployees = employees.filter((employee) => {
    if (filters.gender !== "all" && employee.gender !== filters.gender) {
      return false;
    }

    if (filters.position !== "all" && employee.position !== filters.position) {
      return false;
    }

    const age = differenceInYears(new Date(), new Date(employee.birthdate));

    if (filters.ageGroup !== "all") {
      if (filters.ageGroup === "under30" && age >= 30) return false;
      if (filters.ageGroup === "30to50" && (age < 30 || age > 50)) return false;
      if (filters.ageGroup === "over50" && age <= 50) return false;
    }

    // Filter by risk level if employee has health data
    if (filters.riskLevel !== "all" && employee.latestHealthData?.prediction) {
      const riskLevel =
        employee.latestHealthData.prediction.risk_level.toLowerCase();
      if (filters.riskLevel === "low" && !riskLevel.includes("low"))
        return false;
      if (filters.riskLevel === "medium" && !riskLevel.includes("medium"))
        return false;
      if (filters.riskLevel === "high" && !riskLevel.includes("high"))
        return false;
    }

    return true;
  });

  // Prepare chart data
  const getRiskLevelPieData = () => {
    if (!aggregateStats) return [];

    const { riskDistribution } = aggregateStats;
    return [
      { name: "Low Risk", value: riskDistribution.low, color: "#4CAF50" },
      { name: "Medium Risk", value: riskDistribution.medium, color: "#FF9800" },
      { name: "High Risk", value: riskDistribution.high, color: "#F44336" },
    ];
  };

  // Graph data for employee trends
  const getEmployeeTrendData = () => {
    return employeeHealthData
      .map((record) => ({
        date: record.timestamp
          ? format(new Date(record.timestamp), "MM/dd")
          : "Unknown",
        glucose: record.Glucose,
        bmi: record.BMI,
        insulin: record.Insulin,
        bloodPressure: record.BloodPressure,
      }))
      .reverse();
  };

  // Get risk trend data for visualization
  const getRiskTrendData = () => {
    return employeeHealthData
      .map((record) => {
        // Convert risk level to numeric value for visualization
        let riskValue = 0;
        if (record.prediction) {
          if (record.prediction.risk_level === "Low Risk") riskValue = 1;
          else if (record.prediction.risk_level === "Medium Risk")
            riskValue = 2;
          else if (record.prediction.risk_level === "High Risk") riskValue = 3;
        }

        return {
          date: record.timestamp
            ? format(new Date(record.timestamp), "MM/dd")
            : "Unknown",
          risk: riskValue,
          riskLabel: record.prediction
            ? record.prediction.risk_level
            : "Unknown",
          probability: record.prediction
            ? Math.round(record.prediction.probability * 100)
            : 0,
        };
      })
      .reverse();
  };

  // Calculate employee age
  const calculateAge = (birthdate) => {
    return differenceInYears(new Date(), new Date(birthdate));
  };

  return (
    <>
      <NavBar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Status Warning Dialog */}
        <Dialog
          open={showStatusWarning}
          onClose={handleCloseStatusWarning}
          aria-labelledby="status-warning-dialog-title"
          aria-describedby="status-warning-dialog-description"
        >
          <DialogTitle id="status-warning-dialog-title">
            Limited Access Detected
          </DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Your health professional account has limited access to system
              features.
            </Alert>
            <DialogContentText id="status-warning-dialog-description">
              This could be because your account is pending administrator
              approval or has been set to inactive. Some features may be
              unavailable until your account status is updated. If this problem
              persists, please contact the system administrator.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseStatusWarning} color="primary">
              Acknowledge
            </Button>
          </DialogActions>
        </Dialog>

        {/* Employee Details Dialog */}
        <Dialog
          open={employeeDetailsOpen}
          onClose={handleCloseEmployeeDetails}
          maxWidth="lg"
          fullWidth
          aria-labelledby="employee-details-dialog-title"
        >
          <DialogTitle id="employee-details-dialog-title">
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Avatar
                sx={{
                  width: 50,
                  height: 50,
                  bgcolor: "primary.main",
                  fontSize: "1.5rem",
                  mr: 2,
                }}
              >
                {selectedEmployee?.name[0]}
              </Avatar>
              <Box>
                <Typography variant="h6">{selectedEmployee?.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedEmployee && calculateAge(selectedEmployee.birthdate)}{" "}
                  years old • {selectedEmployee?.gender}
                </Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {selectedEmployee && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ height: "100%" }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Latest Readings
                      </Typography>
                      {employeeHealthData.length > 0 ? (
                        <>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                          >
                            Date:{" "}
                            {employeeHealthData[0].timestamp
                              ? format(
                                  new Date(employeeHealthData[0].timestamp),
                                  "MMM dd, yyyy"
                                )
                              : "Unknown"}
                          </Typography>
                          <Box>
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              <Grid item xs={6}>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  Glucose:
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="body1" align="right">
                                  {employeeHealthData[0].Glucose} mg/dL
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  Blood Pressure:
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="body1" align="right">
                                  {employeeHealthData[0].BloodPressure} mm Hg
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  Insulin:
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="body1" align="right">
                                  {employeeHealthData[0].Insulin} μU/ml
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  BMI:
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="body1" align="right">
                                  {employeeHealthData[0].BMI} kg/m²
                                </Typography>
                              </Grid>
                            </Grid>
                          </Box>
                        </>
                      ) : (
                        <Typography color="text.secondary">
                          No health data available
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ height: "100%" }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Latest Prediction
                      </Typography>
                      {employeeHealthData.length > 0 &&
                      employeeHealthData[0].prediction ? (
                        <>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              mb: 2,
                            }}
                          >
                            <Chip
                              label={
                                employeeHealthData[0].prediction.risk_level
                              }
                              color={
                                employeeHealthData[0].prediction.risk_level ===
                                "Low Risk"
                                  ? "success"
                                  : employeeHealthData[0].prediction
                                      .risk_level === "Medium Risk"
                                  ? "warning"
                                  : "error"
                              }
                              sx={{ mr: 1 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              Probability:{" "}
                              {(
                                employeeHealthData[0].prediction.probability *
                                100
                              ).toFixed(1)}
                              %
                            </Typography>
                          </Box>
                          <Typography variant="body2">
                            {employeeHealthData[0].prediction.recommendation ||
                              (employeeHealthData[0].prediction.risk_level ===
                              "Low Risk"
                                ? "Employee has a low risk of diabetes. Continue monitoring regularly."
                                : employeeHealthData[0].prediction
                                    .risk_level === "Medium Risk"
                                ? "Employee has a moderate risk of diabetes. Consider lifestyle changes and more frequent monitoring."
                                : "Employee has a high risk of diabetes. Immediate intervention recommended.")}
                          </Typography>
                        </>
                      ) : (
                        <Typography color="text.secondary">
                          No prediction available
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ height: "100%" }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Employee Information
                      </Typography>
                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={4}>
                          <Typography variant="body2" color="text.secondary">
                            Email:
                          </Typography>
                        </Grid>
                        <Grid item xs={8}>
                          <Typography variant="body2">
                            {selectedEmployee.email}
                          </Typography>
                        </Grid>
                        {/* <Grid item xs={4}>
                          <Typography variant="body2" color="text.secondary">
                            Phone:
                          </Typography>
                        </Grid> */}
                        {/* <Grid item xs={8}>
                          <Typography variant="body2">
                            {selectedEmployee.phone || "Not provided"}
                          </Typography>
                        </Grid> */}
                        <Grid item xs={4}>
                          <Typography variant="body2" color="text.secondary">
                            Birthdate:
                          </Typography>
                        </Grid>
                        <Grid item xs={8}>
                          <Typography variant="body2">
                            {format(
                              new Date(selectedEmployee.birthdate),
                              "MMMM dd, yyyy"
                            )}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 2,
                        }}
                      >
                        <Typography variant="h6">Health Trends</Typography>
                        <Box sx={{ display: "flex", gap: 2 }}>
                          <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                              label="From"
                              value={dateRange.startDate}
                              onChange={(newValue) =>
                                handleDateRangeChange("startDate", newValue)
                              }
                              slotProps={{ textField: { size: "small" } }}
                            />
                            <DatePicker
                              label="To"
                              value={dateRange.endDate}
                              onChange={(newValue) =>
                                handleDateRangeChange("endDate", newValue)
                              }
                              slotProps={{ textField: { size: "small" } }}
                            />
                          </LocalizationProvider>
                        </Box>
                      </Box>
                      {loading ? (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "center",
                            p: 3,
                          }}
                        >
                          <CircularProgress />
                        </Box>
                      ) : employeeHealthData.length > 1 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart
                            data={getEmployeeTrendData()}
                            margin={{
                              top: 5,
                              right: 30,
                              left: 20,
                              bottom: 5,
                            }}
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
                            />
                            <Line
                              type="monotone"
                              dataKey="bloodPressure"
                              name="Blood Pressure (mm Hg)"
                              stroke="#82ca9d"
                            />
                            <Line
                              type="monotone"
                              dataKey="insulin"
                              name="Insulin (μU/ml)"
                              stroke="#ffc658"
                            />
                            <Line
                              type="monotone"
                              dataKey="bmi"
                              name="BMI (kg/m²)"
                              stroke="#ff7300"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <Typography
                          variant="body1"
                          color="text.secondary"
                          sx={{ p: 2, textAlign: "center" }}
                        >
                          Not enough data to display trends. Employee needs at
                          least two health records.
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Risk Prediction Trend
                      </Typography>
                      {loading ? (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "center",
                            p: 3,
                          }}
                        >
                          <CircularProgress />
                        </Box>
                      ) : employeeHealthData.length > 1 ? (
                        <>
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              This chart shows how the employee's diabetes risk
                              has changed over time. Higher values indicate
                              higher risk levels.
                            </Typography>
                          </Box>
                          <ResponsiveContainer width="100%" height={250}>
                            <ComposedChart
                              data={getRiskTrendData()}
                              margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis
                                yAxisId="risk"
                                domain={[0, 3]}
                                ticks={[0, 1, 2, 3]}
                                tickFormatter={(value) => {
                                  if (value === 1) return "Low";
                                  if (value === 2) return "Medium";
                                  if (value === 3) return "High";
                                  return "";
                                }}
                              />
                              <YAxis
                                yAxisId="probability"
                                orientation="right"
                                domain={[0, 100]}
                              />
                              <Tooltip
                                formatter={(value, name) => {
                                  if (name === "Risk Level") {
                                    if (value === 1) return ["Low Risk", name];
                                    if (value === 2)
                                      return ["Medium Risk", name];
                                    if (value === 3) return ["High Risk", name];
                                    return ["Unknown", name];
                                  }
                                  if (name === "Probability") {
                                    return [`${value}%`, name];
                                  }
                                  return [value, name];
                                }}
                              />
                              <Legend />
                              <Bar
                                dataKey="risk"
                                name="Risk Level"
                                yAxisId="risk"
                                fill="#8884d8"
                                radius={[4, 4, 0, 0]}
                              >
                                {getRiskTrendData().map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={
                                      entry.risk === 1
                                        ? "#4CAF50" // Low - green
                                        : entry.risk === 2
                                        ? "#FF9800" // Medium - orange
                                        : entry.risk === 3
                                        ? "#F44336" // High - red
                                        : "#9E9E9E" // Unknown - gray
                                    }
                                  />
                                ))}
                              </Bar>
                              <Line
                                type="monotone"
                                dataKey="probability"
                                name="Probability"
                                yAxisId="probability"
                                stroke="#FF5722"
                                dot={{ r: 5 }}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </>
                      ) : (
                        <Typography
                          variant="body1"
                          color="text.secondary"
                          sx={{ p: 2, textAlign: "center" }}
                        >
                          Not enough data to display risk trends. Employee needs
                          at least two health records with predictions.
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEmployeeDetails} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <Box sx={{ width: "100%" }}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
            sx={{ mb: 3 }}
          >
            <Tab label="Employee List" />
            <Tab label="Aggregate Analytics" />
          </Tabs>

          {/* Employee List Tab */}
          {currentTab === 0 && (
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Your Employees
              </Typography>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Gender</InputLabel>
                    <Select
                      name="gender"
                      value={filters.gender}
                      label="Gender"
                      onChange={handleFilterChange}
                    >
                      <MenuItem value="all">All Genders</MenuItem>
                      <MenuItem value="male">Male</MenuItem>
                      <MenuItem value="female">Female</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Age Group</InputLabel>
                    <Select
                      name="ageGroup"
                      value={filters.ageGroup}
                      label="Age Group"
                      onChange={handleFilterChange}
                    >
                      <MenuItem value="all">All Ages</MenuItem>
                      <MenuItem value="under30">Under 30</MenuItem>
                      <MenuItem value="30to50">30 to 50</MenuItem>
                      <MenuItem value="over50">Over 50</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Risk Level</InputLabel>
                    <Select
                      name="riskLevel"
                      value={filters.riskLevel}
                      label="Risk Level"
                      onChange={handleFilterChange}
                    >
                      <MenuItem value="all">All Risk Levels</MenuItem>
                      <MenuItem value="low">Low Risk</MenuItem>
                      <MenuItem value="medium">Medium Risk</MenuItem>
                      <MenuItem value="high">High Risk</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Position</InputLabel>
                    <Select
                      name="position"
                      value={filters.position}
                      label="Position"
                      onChange={handleFilterChange}
                    >
                      <MenuItem value="all">All Positions</MenuItem>
                      <MenuItem value="driver">Driver</MenuItem>
                      <MenuItem value="cook">Cook</MenuItem>
                      <MenuItem value="chef">Chef</MenuItem>
                      <MenuItem value="kitchen_helper">Kitchen Helper</MenuItem>
                      <MenuItem value="truck_driver">Truck Driver</MenuItem>
                      <MenuItem value="baker">Baker</MenuItem>
                      <MenuItem value="food_tester">Food Tester</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="body2" color="text.secondary">
                    {filteredEmployees.length} employees found
                  </Typography>
                </Grid>
              </Grid>

              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Employee</TableCell>
                        <TableCell>Age</TableCell>
                        <TableCell>Gender</TableCell>
                        <TableCell>Last Visit</TableCell>
                        <TableCell>Risk Level</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredEmployees.length > 0 ? (
                        filteredEmployees.map((employee) => (
                          <TableRow key={employee.id}>
                            <TableCell>
                              <Box
                                sx={{ display: "flex", alignItems: "center" }}
                              >
                                <Avatar sx={{ mr: 2, bgcolor: "primary.main" }}>
                                  {employee.name[0]}
                                </Avatar>
                                <Box>
                                  <Typography variant="body1">
                                    {employee.name}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {employee.email}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {calculateAge(employee.birthdate)}
                            </TableCell>
                            <TableCell>{employee.gender}</TableCell>
                            <TableCell>
                              {employee.latestHealthData?.timestamp
                                ? format(
                                    new Date(
                                      employee.latestHealthData.timestamp
                                    ),
                                    "MMM dd, yyyy"
                                  )
                                : "No visits"}
                            </TableCell>
                            <TableCell>
                              {employee.latestHealthData?.prediction ? (
                                <Chip
                                  label={
                                    employee.latestHealthData.prediction
                                      .risk_level
                                  }
                                  color={
                                    employee.latestHealthData.prediction
                                      .risk_level === "Low Risk"
                                      ? "success"
                                      : employee.latestHealthData.prediction
                                          .risk_level === "Medium Risk"
                                      ? "warning"
                                      : "error"
                                  }
                                  size="small"
                                />
                              ) : (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  No data
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleEmployeeSelect(employee)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography
                              variant="body1"
                              color="text.secondary"
                              sx={{ py: 2 }}
                            >
                              No employees found
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          )}

          {/* Aggregate Analytics Tab */}
          {currentTab === 1 && (
            <>
              {/* Position filter for doctor dashboard */}
              <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  Filter Analytics
                </Typography>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Age Group</InputLabel>
                      <Select
                        name="ageGroup"
                        value={filters.ageGroup}
                        label="Age Group"
                        onChange={handleFilterChange}
                      >
                        <MenuItem value="all">All Ages</MenuItem>
                        <MenuItem value="under30">Under 30</MenuItem>
                        <MenuItem value="30to50">30-50</MenuItem>
                        <MenuItem value="over50">Over 50</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Gender</InputLabel>
                      <Select
                        name="gender"
                        value={filters.gender}
                        label="Gender"
                        onChange={handleFilterChange}
                      >
                        <MenuItem value="all">All Genders</MenuItem>
                        <MenuItem value="male">Male</MenuItem>
                        <MenuItem value="female">Female</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Position</InputLabel>
                      <Select
                        name="position"
                        value={filters.position}
                        label="Position"
                        onChange={handleFilterChange}
                      >
                        <MenuItem value="all">All Positions</MenuItem>
                        <MenuItem value="driver">Driver</MenuItem>
                        <MenuItem value="cook">Cook</MenuItem>
                        <MenuItem value="chef">Chef</MenuItem>
                        <MenuItem value="kitchen_helper">
                          Kitchen Helper
                        </MenuItem>
                        <MenuItem value="truck_driver">Truck Driver</MenuItem>
                        <MenuItem value="baker">Baker</MenuItem>
                        <MenuItem value="food_tester">Food Tester</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DatePicker
                          label="From"
                          value={dateRange.startDate}
                          onChange={(date) =>
                            handleDateRangeChange("startDate", date)
                          }
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              size="small"
                              sx={{ mr: 2 }}
                            />
                          )}
                        />
                        <DatePicker
                          label="To"
                          value={dateRange.endDate}
                          onChange={(date) =>
                            handleDateRangeChange("endDate", date)
                          }
                          renderInput={(params) => (
                            <TextField {...params} size="small" />
                          )}
                        />
                      </LocalizationProvider>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>

              {/* Aggregate Health Metrics Trends */}
              <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Aggregate Health Metrics Trends
                </Typography>
                <Box sx={{ height: 400, mt: 3 }}>
                  {loading ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", pt: 10 }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : aggregateHealthTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={aggregateHealthTrends}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="Glucose"
                          stroke="#8884d8"
                          activeDot={{ r: 8 }}
                          name="Glucose (mg/dL)"
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="BloodPressure"
                          stroke="#82ca9d"
                          name="Blood Pressure (mm Hg)"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="BMI"
                          stroke="#ffc658"
                          name="BMI (kg/m²)"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="Insulin"
                          stroke="#ff8042"
                          name="Insulin (μU/ml)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", p: 5 }}
                    >
                      <Typography variant="body1" color="text.secondary">
                        No data available for the selected filters
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>

              {/* Aggregate Risk Trends */}
              <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Aggregate Risk Trends
                </Typography>
                <Box sx={{ height: 400, mt: 3 }}>
                  {loading ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", pt: 10 }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : aggregateRiskTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={aggregateRiskTrends}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis
                          yAxisId="left"
                          label={{
                            value: "Percentage",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          label={{
                            value: "Probability",
                            angle: 90,
                            position: "insideRight",
                          }}
                        />
                        <Tooltip />
                        <Legend />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="lowRiskPercent"
                          stackId="1"
                          stroke="#4CAF50"
                          fill="#4CAF50"
                          name="Low Risk %"
                        />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="mediumRiskPercent"
                          stackId="1"
                          stroke="#FF9800"
                          fill="#FF9800"
                          name="Medium Risk %"
                        />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="highRiskPercent"
                          stackId="1"
                          stroke="#F44336"
                          fill="#F44336"
                          name="High Risk %"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="averageProbability"
                          stroke="#000000"
                          name="Avg Probability"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", p: 5 }}
                    >
                      <Typography variant="body1" color="text.secondary">
                        No risk data available for the selected filters
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </>
          )}
        </Box>
      </Container>
    </>
  );
};

export default HealthProfessionalDashboard;
