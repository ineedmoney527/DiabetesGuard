import React, { useState, useEffect, useRef } from "react";
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
  IconButton,
  List,
  ListItem,
  ListItemText,
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
  ReferenceLine,
} from "recharts";
import { format, subDays, differenceInYears } from "date-fns";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import NavBar from "../components/NavBar";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import html2canvas from "html2canvas";

// Helper function to format position string for display
const formatPosition = (position) => {
  if (!position) return "Not specified";

  const positionMap = {
    driver: "Driver",
    cook: "Cook",
    chef: "Chef",
    kitchen_helper: "Kitchen Helper",
    truck_driver: "Truck Driver",
    baker: "Baker",
    food_tester: "Food Tester",
  };

  return positionMap[position.toLowerCase()] || position;
};

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
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionForm, setPrescriptionForm] = useState({
    medicines: [
      {
        name: "",
        dosage: "",
        frequency: "",
        duration: "",
        specialInstructions: "",
      },
    ],
    suggestion: "",
  });
  const [prescriptionLoading, setPrescriptionLoading] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState("");
  const [prescriptionSuccess, setPrescriptionSuccess] = useState("");

  // Add refs for charts to be included in PDF
  const healthTrendsChartRef = useRef(null);
  const riskTrendsChartRef = useRef(null);
  const patientHealthTrendsChartRef = useRef(null);
  const patientRiskTrendsChartRef = useRef(null);

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
      fetchPrescriptions(selectedEmployee.id);
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

    if (
      filters.position !== "all" &&
      (!employee.position ||
        employee.position.toLowerCase() !== filters.position.toLowerCase())
    ) {
      return false;
    }

    const age = differenceInYears(new Date(), new Date(employee.birthdate));

    if (filters.ageGroup !== "all") {
      if (filters.ageGroup === "under30" && age >= 30) return false;
      if (filters.ageGroup === "30to50" && (age < 30 || age > 50)) return false;
      if (filters.ageGroup === "over50" && age <= 50) return false;
    }

    // Filter by risk level if employee has health data
    if (
      filters.riskLevel !== "all" &&
      employee.latestHealthData?.prediction &&
      employee.latestHealthData.prediction.risk_level
    ) {
      const riskLevel =
        employee.latestHealthData.prediction.risk_level.toLowerCase();
      if (filters.riskLevel === "low" && !riskLevel.includes("low"))
        return false;
      if (filters.riskLevel === "medium" && !riskLevel.includes("medium"))
        return false;
      if (filters.riskLevel === "high" && !riskLevel.includes("high"))
        return false;
    } else if (filters.riskLevel !== "all") {
      // If filtering by a specific risk level but employee has no risk level data, exclude them
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
        let riskLabel = "Unknown";

        if (record.prediction?.risk_level) {
          const riskLevel = record.prediction.risk_level.toLowerCase();
          if (riskLevel.includes("low")) {
            riskValue = 1;
            riskLabel = "Low Risk";
          } else if (riskLevel.includes("medium")) {
            riskValue = 2;
            riskLabel = "Medium Risk";
          } else if (riskLevel.includes("high")) {
            riskValue = 3;
            riskLabel = "High Risk";
          }
        }

        return {
          date: record.timestamp
            ? format(new Date(record.timestamp), "MM/dd")
            : "Unknown",
          risk: riskValue,
          riskLabel: riskLabel,
          probability: record.prediction?.probability
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

  // Color functions for health metrics
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

  // Generate PDF with aggregate data
  const generateAggregatePDF = async () => {
    try {
      setPdfGenerating(true);
      setPdfError("");

      const doc = new jsPDF();

      // Add title
      doc.setFontSize(18);
      doc.text("Aggregate Diabetes Health Report", 105, 15, {
        align: "center",
      });

      // Add doctor info and date range
      doc.setFontSize(12);
      // doc.text(`Doctor: ${currentUser?.displayName || "N/A"}`, 20, 30);
      doc.text(
        `Date Range: ${format(dateRange.startDate, "MM/dd/yyyy")} - ${format(
          dateRange.endDate,
          "MM/dd/yyyy"
        )}`,
        20,
        40
      );

      // Add filter information
      let yOffset = 50;
      doc.text("Applied Filters:", 20, yOffset);
      doc.text(
        `Age Group: ${
          filters.ageGroup === "all"
            ? "All Ages"
            : filters.ageGroup === "under30"
            ? "Under 30"
            : filters.ageGroup === "30to50"
            ? "30-50"
            : "Over 50"
        }`,
        30,
        yOffset + 10
      );
      doc.text(
        `Gender: ${filters.gender === "all" ? "All Genders" : filters.gender}`,
        30,
        yOffset + 20
      );
      doc.text(
        `Position: ${
          filters.position === "all" ? "All Positions" : filters.position
        }`,
        30,
        yOffset + 30
      );

      yOffset += 40;

      // Add employee statistics
      doc.text("Employee Statistics:", 20, yOffset);
      doc.text(
        `Total Employees: ${filteredEmployees.length}`,
        30,
        yOffset + 10
      );

      if (aggregateStats) {
        doc.text(
          `High Risk Employees: ${aggregateStats.riskDistribution.high}`,
          30,
          yOffset + 20
        );
        doc.text(
          `Medium Risk Employees: ${aggregateStats.riskDistribution.medium}`,
          30,
          yOffset + 30
        );
        doc.text(
          `Low Risk Employees: ${aggregateStats.riskDistribution.low}`,
          30,
          yOffset + 40
        );
      }

      yOffset += 50;

      // Capture and add health trends chart
      if (healthTrendsChartRef.current && aggregateHealthTrends.length > 0) {
        doc.addPage();
        doc.text("Aggregate Health Metrics Trends", 105, 20, {
          align: "center",
        });

        const healthTrendsCanvas = await html2canvas(
          healthTrendsChartRef.current
        );
        const healthTrendsImgData = healthTrendsCanvas.toDataURL("image/png");
        doc.addImage(healthTrendsImgData, "PNG", 15, 30, 180, 80);
      }

      // Add a new page for risk trends
      if (riskTrendsChartRef.current && aggregateRiskTrends.length > 0) {
        doc.addPage();
        doc.text("Aggregate Risk Trends", 105, 20, { align: "center" });

        const riskTrendsCanvas = await html2canvas(riskTrendsChartRef.current);
        const riskTrendsImgData = riskTrendsCanvas.toDataURL("image/png");
        doc.addImage(riskTrendsImgData, "PNG", 15, 30, 180, 80);
      }

      // Add employee list
      if (filteredEmployees.length > 0) {
        doc.addPage();
        doc.text("Employee Risk Summary", 105, 15, { align: "center" });

        const tableData = filteredEmployees.map((employee) => [
          employee.name,
          calculateAge(employee.birthdate),
          employee.gender,
          formatPosition(employee.position),
          employee.latestHealthData?.timestamp
            ? format(
                new Date(employee.latestHealthData.timestamp),
                "MM/dd/yyyy"
              )
            : "No data",
          employee.latestHealthData?.prediction?.risk_level || "No data",
          employee.latestHealthData?.prediction
            ? `${(
                employee.latestHealthData.prediction.probability * 100
              ).toFixed(1)}%`
            : "N/A",
        ]);

        doc.autoTable({
          startY: 25,
          head: [
            [
              "Name",
              "Age",
              "Gender",
              "Position",
              "Last Visit",
              "Risk Level",
              "Probability",
            ],
          ],
          body: tableData,
        });
      }

      // Save the PDF
      doc.save(`aggregate_health_report_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (error) {
      console.error("Error generating aggregate PDF:", error);
      setPdfError("Failed to generate PDF report. Please try again.");
    } finally {
      setPdfGenerating(false);
    }
  };

  // Generate PDF for a specific employee/patient
  const generateEmployeePDF = async () => {
    if (!selectedEmployee) return;

    try {
      setPdfGenerating(true);
      setPdfError("");

      const doc = new jsPDF();

      // Add title
      doc.setFontSize(18);
      doc.text("Employee Health Report", 105, 15, { align: "center" });

      // Add employee info
      doc.setFontSize(14);
      doc.text(`Employee: ${selectedEmployee.name}`, 20, 30);

      doc.setFontSize(12);
      doc.text(`Age: ${calculateAge(selectedEmployee.birthdate)}`, 20, 40);
      doc.text(`Gender: ${selectedEmployee.gender}`, 20, 50);
      doc.text(`Email: ${selectedEmployee.email}`, 20, 60);
      doc.text(
        `Position: ${formatPosition(selectedEmployee.position)}`,
        20,
        70
      );

      // Add date range
      doc.text(
        `Report Period: ${format(dateRange.startDate, "MM/dd/yyyy")} - ${format(
          dateRange.endDate,
          "MM/dd/yyyy"
        )}`,
        20,
        80
      );

      let yOffset = 95;

      // Add latest health data if available
      if (employeeHealthData.length > 0) {
        doc.text("Latest Health Readings:", 20, yOffset);
        yOffset += 10;

        const latestData = employeeHealthData[0];
        doc.text(
          `Date: ${format(new Date(latestData.timestamp), "MM/dd/yyyy")}`,
          30,
          yOffset
        );
        yOffset += 10;

        // Glucose with color
        const glucoseColor = getGlucoseColor(latestData.Glucose);
        const glucoseText = `Glucose: ${latestData.Glucose} mg/dL`;

        // First, draw white background to cover any existing text
        doc.setFillColor(255, 255, 255);
        const glucoseWidth = doc.getTextWidth(glucoseText);
        doc.rect(30, yOffset - 5, glucoseWidth + 2, 10, "F");

        // Then draw colored text
        doc.setTextColor(
          hexToRgb(glucoseColor).r,
          hexToRgb(glucoseColor).g,
          hexToRgb(glucoseColor).b
        );
        doc.text(glucoseText, 30, yOffset);
        doc.setTextColor(0, 0, 0); // Reset to black
        yOffset += 10;

        // Blood Pressure with color
        const bpColor = getBloodPressureColor(latestData.BloodPressure);
        const bpText = `Blood Pressure: ${latestData.BloodPressure} mm Hg`;

        // First, draw white background
        doc.setFillColor(255, 255, 255);
        const bpWidth = doc.getTextWidth(bpText);
        doc.rect(30, yOffset - 5, bpWidth + 2, 10, "F");

        // Then draw colored text
        doc.setTextColor(
          hexToRgb(bpColor).r,
          hexToRgb(bpColor).g,
          hexToRgb(bpColor).b
        );
        doc.text(bpText, 30, yOffset);
        doc.setTextColor(0, 0, 0); // Reset to black
        yOffset += 10;

        // Insulin with color
        const insulinColor = getInsulinColor(latestData.Insulin);
        const insulinText = `Insulin: ${latestData.Insulin} μU/ml`;

        // First, draw white background
        doc.setFillColor(255, 255, 255);
        const insulinWidth = doc.getTextWidth(insulinText);
        doc.rect(30, yOffset - 5, insulinWidth + 2, 10, "F");

        // Then draw colored text
        doc.setTextColor(
          hexToRgb(insulinColor).r,
          hexToRgb(insulinColor).g,
          hexToRgb(insulinColor).b
        );
        doc.text(insulinText, 30, yOffset);
        doc.setTextColor(0, 0, 0); // Reset to black
        yOffset += 10;

        // BMI with color
        const bmiColor = getBMIColor(latestData.BMI);
        const bmiText = `BMI: ${latestData.BMI} kg/m²`;

        // First, draw white background
        doc.setFillColor(255, 255, 255);
        const bmiWidth = doc.getTextWidth(bmiText);
        doc.rect(30, yOffset - 5, bmiWidth + 2, 10, "F");

        // Then draw colored text
        doc.setTextColor(
          hexToRgb(bmiColor).r,
          hexToRgb(bmiColor).g,
          hexToRgb(bmiColor).b
        );
        doc.text(bmiText, 30, yOffset);
        doc.setTextColor(0, 0, 0); // Reset to black
        yOffset += 10;

        // Add latest prediction if available
        if (latestData.prediction) {
          yOffset += 5;
          doc.text("Latest Prediction:", 20, yOffset);
          yOffset += 10;

          // Set risk level color
          const riskColor = latestData.prediction.risk_level
            .toLowerCase()
            .includes("low")
            ? "#4CAF50"
            : latestData.prediction.risk_level.toLowerCase().includes("medium")
            ? "#FF9800"
            : "#F44336";

          // Save original background color
          const riskLevelText = `Risk Level: ${latestData.prediction.risk_level}`;

          // First, draw white background to cover any existing text
          doc.setFillColor(255, 255, 255);
          const textWidth = doc.getTextWidth(riskLevelText);
          doc.rect(30, yOffset - 5, textWidth + 2, 10, "F");

          // Then draw colored text
          doc.setTextColor(
            hexToRgb(riskColor).r,
            hexToRgb(riskColor).g,
            hexToRgb(riskColor).b
          );
          doc.text(riskLevelText, 30, yOffset);
          doc.setTextColor(0, 0, 0); // Reset to black
          yOffset += 10;
          doc.text(
            `Probability: ${(latestData.prediction.probability * 100).toFixed(
              1
            )}%`,
            30,
            yOffset
          );
          yOffset += 15;
        }

        // Add a table with historical data with colored values
        doc.autoTable({
          startY: yOffset,
          head: [
            [
              "Date",
              "Glucose",
              "BP",
              "BMI",
              "Insulin",
              "Risk Level",
              "Probability",
            ],
          ],
          body: employeeHealthData.map((record) => [
            record.timestamp
              ? format(new Date(record.timestamp), "MM/dd/yyyy")
              : "N/A",
            record.Glucose,
            record.BloodPressure,
            record.BMI,
            record.Insulin,
            record.prediction?.risk_level || "N/A",
            record.prediction
              ? `${(record.prediction.probability * 100).toFixed(1)}%`
              : "N/A",
          ]),
          didDrawCell: (data) => {
            // Check if it's a body cell (not header) and we need to color it
            if (data.section === "body") {
              const rowIndex = data.row.index;
              const colIndex = data.column.index;
              const record = employeeHealthData[rowIndex];

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

        // Add a new page for charts
        doc.addPage();
        yOffset = 20;

        // Add health trends chart if there are at least 2 data points
        if (
          patientHealthTrendsChartRef.current &&
          employeeHealthData.length > 1
        ) {
          doc.addPage();
          doc.text("Health Metrics Trends", 105, 20, { align: "center" });

          const healthTrendsCanvas = await html2canvas(
            patientHealthTrendsChartRef.current
          );
          const healthTrendsImgData = healthTrendsCanvas.toDataURL("image/png");
          doc.addImage(healthTrendsImgData, "PNG", 15, 30, 180, 80);
        }

        // Add risk trends chart if there are at least 2 data points
        if (
          patientRiskTrendsChartRef.current &&
          employeeHealthData.length > 1
        ) {
          doc.addPage();
          doc.text("Risk Prediction Trend", 105, 20, { align: "center" });

          const riskTrendsCanvas = await html2canvas(
            patientRiskTrendsChartRef.current
          );
          const riskTrendsImgData = riskTrendsCanvas.toDataURL("image/png");
          doc.addImage(riskTrendsImgData, "PNG", 15, 30, 180, 80);
        }
      } else {
        doc.text("No health data available for this employee.", 20, yOffset);
      }

      // Save the PDF
      doc.save(
        `employee_health_report_${selectedEmployee.name.replace(
          /\s+/g,
          "_"
        )}_${format(new Date(), "yyyyMMdd")}.pdf`
      );
    } catch (error) {
      console.error("Error generating employee PDF:", error);
      setPdfError("Failed to generate PDF report. Please try again.");
    } finally {
      setPdfGenerating(false);
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

  // Fetch prescriptions for the selected employee
  const fetchPrescriptions = async (employeeId) => {
    try {
      const token = await currentUser.getIdToken();

      console.log("Fetching prescriptions for employee:", employeeId);

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/health/patients/${employeeId}/prescriptions`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log("Prescriptions API response:", response.data);
      setPrescriptions(response.data);
    } catch (error) {
      console.error("Error fetching prescriptions:", error);
      console.error("Error details:", error.response?.data || error.message);
    }
  };

  const handlePrescriptionDialogOpen = () => {
    setPrescriptionDialogOpen(true);
    setPrescriptionError("");
    setPrescriptionSuccess("");
  };

  const handlePrescriptionDialogClose = () => {
    setPrescriptionDialogOpen(false);
  };

  const handlePrescriptionChange = (e) => {
    const { name, value } = e.target;
    setPrescriptionForm({
      ...prescriptionForm,
      [name]: value,
    });
  };

  const handleMedicineChange = (index, field, value) => {
    const updatedMedicines = [...prescriptionForm.medicines];
    updatedMedicines[index][field] = value;
    setPrescriptionForm({
      ...prescriptionForm,
      medicines: updatedMedicines,
    });
  };

  const addMedicine = () => {
    setPrescriptionForm({
      ...prescriptionForm,
      medicines: [
        ...prescriptionForm.medicines,
        {
          name: "",
          dosage: "",
          frequency: "",
          duration: "",
          specialInstructions: "",
        },
      ],
    });
  };

  const removeMedicine = (index) => {
    const updatedMedicines = [...prescriptionForm.medicines];
    updatedMedicines.splice(index, 1);
    setPrescriptionForm({
      ...prescriptionForm,
      medicines: updatedMedicines,
    });
  };

  const submitPrescription = async () => {
    if (!selectedEmployee) return;

    try {
      setPrescriptionLoading(true);
      setPrescriptionError("");

      const token = await currentUser.getIdToken();

      await axios.post(
        `${process.env.REACT_APP_API_URL}/health/patients/${selectedEmployee.id}/prescription`,
        prescriptionForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPrescriptionSuccess("Prescription added successfully");

      // Reset form after successful submission
      setPrescriptionForm({
        medicines: [
          {
            name: "",
            dosage: "",
            frequency: "",
            duration: "",
            specialInstructions: "",
          },
        ],
        suggestion: "",
      });

      // Add a small delay to ensure the serverTimestamp in Firestore is properly set
      console.log("Waiting before fetching updated prescriptions...");
      setTimeout(() => {
        console.log("Fetching prescriptions after submission...");
        fetchPrescriptions(selectedEmployee.id);

        // Close dialog after short delay
        setTimeout(() => {
          setPrescriptionDialogOpen(false);
          setPrescriptionSuccess("");
        }, 1500);
      }, 1000);
    } catch (error) {
      console.error("Error submitting prescription:", error);
      setPrescriptionError("Failed to add prescription. Please try again.");
    } finally {
      setPrescriptionLoading(false);
    }
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
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
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
                    {selectedEmployee &&
                      calculateAge(selectedEmployee.birthdate)}{" "}
                    years old • {selectedEmployee?.gender}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handlePrescriptionDialogOpen}
                  sx={{ mr: 2 }}
                >
                  Add Prescription
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={generateEmployeePDF}
                  disabled={pdfGenerating || employeeHealthData.length === 0}
                >
                  {pdfGenerating ? (
                    <CircularProgress size={24} />
                  ) : (
                    "Export PDF"
                  )}
                </Button>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {pdfError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {pdfError}
              </Alert>
            )}
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
                                <Typography
                                  variant="body1"
                                  align="right"
                                  sx={{
                                    color: getGlucoseColor(
                                      employeeHealthData[0].Glucose
                                    ),
                                  }}
                                >
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
                                <Typography
                                  variant="body1"
                                  align="right"
                                  sx={{
                                    color: getBloodPressureColor(
                                      employeeHealthData[0].BloodPressure
                                    ),
                                  }}
                                >
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
                                <Typography
                                  variant="body1"
                                  align="right"
                                  sx={{
                                    color: getInsulinColor(
                                      employeeHealthData[0].Insulin
                                    ),
                                  }}
                                >
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
                                <Typography
                                  variant="body1"
                                  align="right"
                                  sx={{
                                    color: getBMIColor(
                                      employeeHealthData[0].BMI
                                    ),
                                  }}
                                >
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
                      employeeHealthData[0]?.prediction?.risk_level ? (
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
                                employeeHealthData[0].prediction.risk_level
                                  .toLowerCase()
                                  .includes("low")
                                  ? "success"
                                  : employeeHealthData[0].prediction.risk_level
                                      .toLowerCase()
                                      .includes("medium")
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
                        <Grid item xs={4}>
                          <Typography variant="body2" color="text.secondary">
                            Position:
                          </Typography>
                        </Grid>
                        <Grid item xs={8}>
                          <Typography variant="body2">
                            {formatPosition(selectedEmployee.position)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Prescriptions & Suggestions
                      </Typography>
                      {prescriptions.length > 0 ? (
                        <List>
                          {prescriptions.map((prescription) => (
                            <React.Fragment key={prescription.id}>
                              <ListItem alignItems="flex-start">
                                <ListItemText
                                  primary={
                                    <Typography variant="subtitle1">
                                      {format(
                                        new Date(prescription.timestamp),
                                        "MMMM dd, yyyy"
                                      )}
                                    </Typography>
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

                                      {prescription.medicines.map(
                                        (medicine, index) => (
                                          <Box
                                            key={index}
                                            sx={{ mt: 1, ml: 2, mb: 1 }}
                                          >
                                            <Typography
                                              variant="body2"
                                              component="p"
                                              fontWeight="bold"
                                            >
                                              {medicine.name}
                                            </Typography>
                                            <Typography
                                              variant="body2"
                                              component="p"
                                            >
                                              Dosage: {medicine.dosage} |
                                              Frequency: {medicine.frequency} |
                                              Duration: {medicine.duration}
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
                                        )
                                      )}
                                    </>
                                  }
                                />
                              </ListItem>
                              <Divider />
                            </React.Fragment>
                          ))}
                        </List>
                      ) : (
                        <Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ py: 2 }}
                          >
                            No prescriptions or suggestions have been given yet.
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            sx={{ mt: 1 }}
                            onClick={() => {
                              if (selectedEmployee) {
                                fetchPrescriptions(selectedEmployee.id);
                              }
                            }}
                          >
                            Refresh Prescriptions
                          </Button>
                        </Box>
                      )}
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
                        <ResponsiveContainer
                          width="100%"
                          height={300}
                          ref={patientHealthTrendsChartRef}
                        >
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
                          <ResponsiveContainer
                            width="100%"
                            height={250}
                            ref={patientRiskTrendsChartRef}
                          >
                            <LineChart
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
                                dataKey="probability"
                                name="Diabetes Risk"
                                stroke="#e91e63"
                                activeDot={{ r: 8 }}
                                strokeWidth={3}
                                dot={{
                                  stroke: "#e91e63",
                                  strokeWidth: 2,
                                  r: 4,
                                  fill: (entry) =>
                                    entry.riskLabel
                                      .toLowerCase()
                                      .includes("low")
                                      ? "#4CAF50"
                                      : entry.riskLabel
                                          .toLowerCase()
                                          .includes("medium")
                                      ? "#FF9800"
                                      : "#F44336",
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

        {/* Prescription Dialog */}
        <Dialog
          open={prescriptionDialogOpen}
          onClose={handlePrescriptionDialogClose}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Add Prescription for {selectedEmployee?.name}
          </DialogTitle>
          <DialogContent>
            {prescriptionError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {prescriptionError}
              </Alert>
            )}
            {prescriptionSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {prescriptionSuccess}
              </Alert>
            )}

            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Suggestion
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              name="suggestion"
              label="Suggestion"
              variant="outlined"
              value={prescriptionForm.suggestion}
              onChange={handlePrescriptionChange}
              placeholder="Enter any general health advice or suggestions for the patient"
              sx={{ mb: 3 }}
            />

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="subtitle1" gutterBottom>
                Medicines
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                onClick={addMedicine}
                size="small"
              >
                Add Medicine
              </Button>
            </Box>

            {prescriptionForm.medicines.map((medicine, index) => (
              <Box
                key={index}
                sx={{
                  mb: 3,
                  p: 2,
                  border: "1px solid #e0e0e0",
                  borderRadius: "4px",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <Typography variant="subtitle2">
                    Medicine #{index + 1}
                  </Typography>
                  {index > 0 && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => removeMedicine(index)}
                    >
                      Remove
                    </Button>
                  )}
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      required
                      label="Medicine Name"
                      value={medicine.name}
                      onChange={(e) =>
                        handleMedicineChange(index, "name", e.target.value)
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      label="Dosage"
                      value={medicine.dosage}
                      onChange={(e) =>
                        handleMedicineChange(index, "dosage", e.target.value)
                      }
                      placeholder="e.g., 500mg"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      label="Frequency"
                      value={medicine.frequency}
                      onChange={(e) =>
                        handleMedicineChange(index, "frequency", e.target.value)
                      }
                      placeholder="e.g., Twice daily"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      label="Duration"
                      value={medicine.duration}
                      onChange={(e) =>
                        handleMedicineChange(index, "duration", e.target.value)
                      }
                      placeholder="e.g., 7 days"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Special Instructions"
                      value={medicine.specialInstructions}
                      onChange={(e) =>
                        handleMedicineChange(
                          index,
                          "specialInstructions",
                          e.target.value
                        )
                      }
                      placeholder="e.g., Take after meals"
                    />
                  </Grid>
                </Grid>
              </Box>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={handlePrescriptionDialogClose} color="primary">
              Cancel
            </Button>
            <Button
              onClick={submitPrescription}
              color="primary"
              variant="contained"
              disabled={
                prescriptionLoading ||
                prescriptionForm.medicines.some(
                  (m) => !m.name || !m.dosage || !m.frequency || !m.duration
                )
              }
            >
              {prescriptionLoading ? (
                <CircularProgress size={24} />
              ) : (
                "Save Prescription"
              )}
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
                        <TableCell>Position</TableCell>
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
                              {formatPosition(employee.position)}
                            </TableCell>
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
                              {employee.latestHealthData?.prediction
                                ?.risk_level ? (
                                <Chip
                                  label={
                                    employee.latestHealthData.prediction
                                      .risk_level
                                  }
                                  color={
                                    employee.latestHealthData.prediction.risk_level
                                      .toLowerCase()
                                      .includes("low")
                                      ? "success"
                                      : employee.latestHealthData.prediction.risk_level
                                          .toLowerCase()
                                          .includes("medium")
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
                          <TableCell colSpan={7} align="center">
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
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <Typography variant="h5" component="h2" gutterBottom>
                    Filter Analytics
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={generateAggregatePDF}
                    disabled={
                      pdfGenerating ||
                      (aggregateHealthTrends.length === 0 &&
                        aggregateRiskTrends.length === 0)
                    }
                  >
                    {pdfGenerating ? (
                      <CircularProgress size={24} />
                    ) : (
                      "Export PDF Report"
                    )}
                  </Button>
                </Box>

                {pdfError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {pdfError}
                  </Alert>
                )}

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
                <Box sx={{ height: 400, mt: 3 }} ref={healthTrendsChartRef}>
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
                <Box sx={{ height: 400, mt: 3 }} ref={riskTrendsChartRef}>
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
                          dataKey="avgProbability"
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
