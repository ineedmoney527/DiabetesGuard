import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  IconButton,
  AppBar,
  Toolbar,
  Menu,
  Avatar,
  TablePagination,
  TableSortLabel,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  Check,
  Close,
  Delete,
  History,
  Search,
  FilterList,
  Logout,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { styled } from "@mui/material/styles";

// API URL
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

// Admin credentials from environment variables
const ADMIN_EMAIL =
  process.env.REACT_APP_ADMIN_EMAIL || "coffeebean2jh@gmail.com";
const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || "12345678";

// Styled components
const StyledTableRow = styled(TableRow)(({ theme }) => ({
  "&:nth-of-type(odd)": {
    backgroundColor: theme.palette.action.hover,
  },
  "&:hover": {
    backgroundColor: theme.palette.action.selected,
  },
}));

const TabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [tab, setTab] = useState(0);
  const [users, setUsers] = useState([]);
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionHistory, setActionHistory] = useState([]);
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState("name");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState(null);

  // Check if current user is the admin
  useEffect(() => {
    if (currentUser?.email !== ADMIN_EMAIL) {
      toast.error("Unauthorized access");
      navigate("/login");
    }
  }, [currentUser, navigate]);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Function to fetch all data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await currentUser.getIdToken();

      // Fetch all users
      const usersResponse = await axios.get(`${API_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Extract pending doctors
      const pending = usersResponse.data.filter(
        (user) => user.role === "doctor" && user.status === "inactive"
      );

      // Fetch action history
      const historyResponse = await axios.get(
        `${API_URL}/users/action-history`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUsers(usersResponse.data);
      setPendingDoctors(pending);
      setActionHistory(historyResponse.data || []);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data. Please try again.");
      toast.error("Error loading dashboard data");
    } finally {
      setLoading(false);
    }
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  // Handle approval
  const handleApprove = async (userId) => {
    try {
      const token = await currentUser.getIdToken();
      await axios.post(
        `${API_URL}/users/approve-doctor/${userId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success("Account approved successfully");
      // Update local state
      const updatedUsers = users.map((user) =>
        user.id === userId ? { ...user, status: "active" } : user
      );
      setUsers(updatedUsers);
      setPendingDoctors(pendingDoctors.filter((user) => user.id !== userId));

      // Add to history
      const approvedUser = users.find((user) => user.id === userId);
      if (approvedUser) {
        const historyEntry = {
          userId,
          userName: approvedUser.name,
          action: "approved",
          timestamp: new Date().toISOString(),
        };
        setActionHistory([historyEntry, ...actionHistory]);
      }
    } catch (err) {
      console.error("Error approving user:", err);
      toast.error("Failed to approve user");
    }
  };

  // Handle rejection
  const handleReject = async (userId) => {
    try {
      const token = await currentUser.getIdToken();
      await axios.post(
        `${API_URL}/users/reject-doctor/${userId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success("Account rejected");
      // Update local state
      const updatedUsers = users.map((user) =>
        user.id === userId ? { ...user, status: "rejected" } : user
      );
      setUsers(updatedUsers);
      setPendingDoctors(pendingDoctors.filter((user) => user.id !== userId));

      // Add to history
      const rejectedUser = users.find((user) => user.id === userId);
      if (rejectedUser) {
        const historyEntry = {
          userId,
          userName: rejectedUser.name,
          action: "rejected",
          timestamp: new Date().toISOString(),
        };
        setActionHistory([historyEntry, ...actionHistory]);
      }
    } catch (err) {
      console.error("Error rejecting user:", err);
      toast.error("Failed to reject user");
    }
  };

  // Handle open delete dialog
  const handleOpenDeleteDialog = (user) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const token = await currentUser.getIdToken();
      await axios.delete(`${API_URL}/users/${selectedUser.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      toast.success(`${selectedUser.name} deleted successfully`);

      // Update local state
      setUsers(users.filter((user) => user.id !== selectedUser.id));
      setPendingDoctors(
        pendingDoctors.filter((user) => user.id !== selectedUser.id)
      );

      // Add to history
      const historyEntry = {
        userId: selectedUser.id,
        userName: selectedUser.name,
        action: "deleted",
        timestamp: new Date().toISOString(),
      };
      setActionHistory([historyEntry, ...actionHistory]);

      setDeleteDialogOpen(false);
    } catch (err) {
      console.error("Error deleting user:", err);
      toast.error("Failed to delete user");
    }
  };

  // Handle search
  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  // Handle role filter
  const handleRoleFilterChange = (event) => {
    setRoleFilter(event.target.value);
    setPage(0);
  };

  // Handle sort change
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter and sort users
  const filteredUsers = users.filter((user) => {
    // Apply role filter
    if (roleFilter !== "all" && user.role !== roleFilter) return false;

    // Apply search query
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const isAsc = order === "asc";
    if (!a[orderBy] || !b[orderBy]) return 0;

    if (typeof a[orderBy] === "string") {
      return isAsc
        ? a[orderBy].localeCompare(b[orderBy])
        : b[orderBy].localeCompare(a[orderBy]);
    } else {
      return isAsc ? a[orderBy] - b[orderBy] : b[orderBy] - a[orderBy];
    }
  });

  const paginatedUsers = sortedUsers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Handle user menu
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out");
    }
  };

  // Status chip color
  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "success";
      case "inactive":
        return "default";
      case "pending":
        return "warning";
      case "rejected":
        return "error";
      default:
        return "default";
    }
  };

  // Render loading state
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading dashboard...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* App Bar */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Admin Dashboard
          </Typography>
          <IconButton
            size="large"
            color="inherit"
            onClick={handleMenuOpen}
            aria-controls="menu-appbar"
            aria-haspopup="true"
          >
            <Avatar sx={{ bgcolor: "primary.dark" }}>
              {currentUser?.email?.charAt(0)?.toUpperCase() || "A"}
            </Avatar>
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
            keepMounted
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleLogout}>
              <Logout fontSize="small" sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs
            value={tab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            centered
          >
            <Tab label="Pending Approvals" />
            <Tab label="All Users" />
            <Tab label="Activity History" />
          </Tabs>
        </Paper>

        {/* Pending Approvals Tab */}
        <TabPanel value={tab} index={0}>
          <Typography variant="h5" gutterBottom>
            Pending Approvals
          </Typography>

          {pendingDoctors.length === 0 ? (
            <Alert severity="info">No pending approvals</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    {/* <TableCell>Phone</TableCell> */}
                    <TableCell>Role</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingDoctors.map((user) => (
                    <StyledTableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      {/* <TableCell>{user.phone}</TableCell> */}
                      <TableCell>
                        <Chip
                          label={user.role}
                          color={
                            user.role === "doctor" ? "primary" : "secondary"
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          startIcon={<Check />}
                          color="success"
                          variant="outlined"
                          size="small"
                          sx={{ mr: 1 }}
                          onClick={() => handleApprove(user.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          startIcon={<Close />}
                          color="error"
                          variant="outlined"
                          size="small"
                          onClick={() => handleReject(user.id)}
                        >
                          Reject
                        </Button>
                      </TableCell>
                    </StyledTableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* All Users Tab */}
        <TabPanel value={tab} index={1}>
          <Typography variant="h5" gutterBottom>
            All Users
          </Typography>

          <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
            <TextField
              label="Search"
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: <Search color="action" sx={{ mr: 1 }} />,
              }}
              sx={{ flexGrow: 1 }}
            />

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="role-filter-label">Role</InputLabel>
              <Select
                labelId="role-filter-label"
                value={roleFilter}
                label="Role"
                onChange={handleRoleFilterChange}
                startAdornment={<FilterList color="action" sx={{ mr: 1 }} />}
              >
                <MenuItem value="all">All Roles</MenuItem>
                <MenuItem value="patient">Patients</MenuItem>
                <MenuItem value="doctor">Doctors</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === "name"}
                      direction={orderBy === "name" ? order : "asc"}
                      onClick={() => handleRequestSort("name")}
                    >
                      Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === "email"}
                      direction={orderBy === "email" ? order : "asc"}
                      onClick={() => handleRequestSort("email")}
                    >
                      Email
                    </TableSortLabel>
                  </TableCell>
                  {/* <TableCell>Phone</TableCell> */}
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === "role"}
                      direction={orderBy === "role" ? order : "asc"}
                      onClick={() => handleRequestSort("role")}
                    >
                      Role
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === "status"}
                      direction={orderBy === "status" ? order : "asc"}
                      onClick={() => handleRequestSort("status")}
                    >
                      Status
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user) => (
                    <StyledTableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      {/* <TableCell>{user.phone}</TableCell> */}
                      <TableCell>
                        <Chip
                          label={user.role}
                          color={
                            user.role === "doctor" ? "primary" : "secondary"
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.status || "active"}
                          color={getStatusColor(user.status || "active")}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() => handleOpenDeleteDialog(user)}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </StyledTableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredUsers.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </TableContainer>
        </TabPanel>

        {/* Activity History Tab */}
        <TabPanel value={tab} index={2}>
          <Typography variant="h5" gutterBottom>
            Activity History
          </Typography>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === "timestamp"}
                      direction={orderBy === "timestamp" ? order : "desc"}
                      onClick={() => handleRequestSort("timestamp")}
                    >
                      Timestamp
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {actionHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      No activity recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  actionHistory.map((entry, index) => (
                    <StyledTableRow key={index}>
                      <TableCell>
                        {new Date(entry.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>{entry.userName}</TableCell>
                      <TableCell>
                        <Chip
                          label={entry.action}
                          color={
                            entry.action === "approved"
                              ? "success"
                              : entry.action === "rejected"
                              ? "error"
                              : "default"
                          }
                          size="small"
                        />
                      </TableCell>
                    </StyledTableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Container>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedUser?.name}? This action
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteUser} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDashboard;
