import axios from "axios";
import logger from "./logger";

// Create an axios instance with default configs
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Log request details
api.interceptors.request.use(
  (config) => {
    // Start a performance timer for this request
    config.timer = logger.startTimer(
      `API Request: ${config.method.toUpperCase()} ${config.url}`
    );

    // Log the request
    logger.debug(`API Request: ${config.method.toUpperCase()} ${config.url}`, {
      method: config.method,
      url: config.url,
      params: config.params,
      // Don't log sensitive data
      body: config.url.includes("/auth") ? "(sensitive data)" : config.data,
    });

    // Add token to request if available
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    // Log the request error
    logger.error("API Request Error", error);
    return Promise.reject(error);
  }
);

// Log response details
api.interceptors.response.use(
  (response) => {
    // Stop the performance timer
    if (response.config.timer) {
      response.config.timer.stop({
        url: response.config.url,
        method: response.config.method,
        status: response.status,
      });
    }

    // Log the response
    logger.debug(
      `API Response: ${response.config.method.toUpperCase()} ${
        response.config.url
      }`,
      {
        method: response.config.method,
        url: response.config.url,
        status: response.status,
        data: response.config.url.includes("/auth")
          ? "(sensitive data)"
          : response.data,
      }
    );

    return response;
  },
  (error) => {
    // Stop the performance timer
    if (error.config?.timer) {
      error.config.timer.stop({
        url: error.config.url,
        method: error.config.method,
        status: error.response?.status,
        error: true,
      });
    }

    // Log the error response
    logger.error("API Response Error", error, {
      method: error.config?.method,
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
    });

    // Handle specific error statuses
    switch (error.response?.status) {
      case 401:
        // Unauthorized - redirect to login
        if (!error.config.url.includes("/auth")) {
          logger.userAction("logout", { reason: "Unauthorized response" });
          // Redirect to login or dispatch logout action
          // window.location.href = '/login';
        }
        break;

      case 403:
        // Forbidden - MFA required or insufficient permissions
        logger.warn("Access forbidden", {
          url: error.config?.url,
        });
        break;

      case 500:
        // Server error
        logger.error("Server error", error, {
          url: error.config?.url,
        });
        break;

      default:
        // Other errors
        break;
    }

    return Promise.reject(error);
  }
);

export default api;
