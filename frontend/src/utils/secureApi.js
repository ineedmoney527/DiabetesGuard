import axios from "axios";
import CryptoJS from "crypto-js";
import logger from "../utils/logger";

/**
 * Secure API client with encryption capabilities for sensitive data
 */
class SecureApiClient {
  constructor() {
    this.apiUrl = process.env.REACT_APP_API_URL;
    this.encryptionKey =
      process.env.REACT_APP_CLIENT_ENCRYPTION_KEY ||
      "default-frontend-encryption-key";

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor for auth tokens
    this.client.interceptors.request.use(
      async (config) => {
        try {
          // Get the current authentication token from localStorage
          const authToken = localStorage.getItem("authToken");

          // Get MFA code from sessionStorage
          const mfaCode = sessionStorage.getItem("mfa_code");

          // Add auth token if available
          if (authToken) {
            config.headers.Authorization = `Bearer ${authToken}`;
            logger.debug("Adding auth token to request headers");

            // Add MFA code if available
            if (mfaCode) {
              config.headers["x-totp-code"] = mfaCode;
              logger.debug("Adding MFA code to request headers");
            }
          } else {
            // Fallback to Firebase currentUser if no token in localStorage
            const currentUser = window.firebase?.auth?.currentUser;
            if (currentUser) {
              const token = await currentUser.getIdToken();
              config.headers.Authorization = `Bearer ${token}`;

              if (mfaCode) {
                config.headers["x-totp-code"] = mfaCode;
              }
            }
          }

          return config;
        } catch (error) {
          logger.error("Error in request interceptor:", error);
          return config;
        }
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle MFA requirement
        if (
          error.response?.status === 403 &&
          error.response?.data?.requireMfa
        ) {
          // Redirect to MFA verification or trigger MFA flow
          window.dispatchEvent(new CustomEvent("mfa-required"));
        }

        // Handle auth token expiration/invalid
        if (error.response?.status === 401) {
          logger.warn("Authentication error - token may be expired or invalid");

          // Clear the stored token if it's invalid
          const authToken = localStorage.getItem("authToken");
          if (authToken) {
            logger.warn("Clearing invalid auth token");
            localStorage.removeItem("authToken");

            // Optionally redirect to login
            if (window.location.pathname !== "/login") {
              window.location.href = "/login";
            }
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Encrypt sensitive data
   * @param {Object|string} data - Data to encrypt
   * @returns {string} - Encrypted data string
   */
  encrypt(data) {
    const dataStr =
      typeof data === "object" ? JSON.stringify(data) : String(data);
    return CryptoJS.AES.encrypt(dataStr, this.encryptionKey).toString();
  }

  /**
   * Decrypt encrypted data
   * @param {string} encryptedData - Encrypted data string
   * @returns {Object|string} - Decrypted data
   */
  decrypt(encryptedData) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

      // Try to parse as JSON if possible
      try {
        if (
          decryptedString.startsWith("{") ||
          decryptedString.startsWith("[")
        ) {
          return JSON.parse(decryptedString);
        }
      } catch (e) {
        // If parsing fails, return as string
      }

      return decryptedString;
    } catch (error) {
      logger.error("Failed to decrypt data", error);
      throw new Error("Decryption failed");
    }
  }

  /**
   * Make a secure POST request with encrypted sensitive data
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request payload
   * @param {string[]} sensitiveFields - Array of field names to encrypt
   * @param {Object} options - Additional axios options
   * @returns {Promise} - API response
   */
  async securePost(endpoint, data, sensitiveFields = [], options = {}) {
    try {
      // Create a copy of the data to avoid modifying the original
      const secureData = { ...data };

      // Encrypt sensitive fields if specified
      if (sensitiveFields.length > 0) {
        // If all data should be encrypted as one object
        if (sensitiveFields.includes("*")) {
          return this.client.post(
            endpoint,
            { encryptedPayload: this.encrypt(data) },
            options
          );
        }

        // Otherwise encrypt individual fields
        sensitiveFields.forEach((field) => {
          if (secureData[field] !== undefined) {
            secureData[field] = this.encrypt(secureData[field]);
          }
        });
      }

      return this.client.post(endpoint, secureData, options);
    } catch (error) {
      logger.error(`Error in secure POST to ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - URL parameters
   * @param {Object} options - Additional axios options
   * @returns {Promise} - API response
   */
  async get(endpoint, params = {}, options = {}) {
    try {
      const config = {
        ...options,
        params,
      };

      return this.client.get(endpoint, config);
    } catch (error) {
      logger.error(`Error in GET to ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Make a regular POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request payload
   * @param {Object} options - Additional axios options
   * @returns {Promise} - API response
   */
  async post(endpoint, data, options = {}) {
    try {
      return this.client.post(endpoint, data, options);
    } catch (error) {
      logger.error(`Error in POST to ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request payload
   * @param {Object} options - Additional axios options
   * @returns {Promise} - API response
   */
  async put(endpoint, data, options = {}) {
    try {
      return this.client.put(endpoint, data, options);
    } catch (error) {
      logger.error(`Error in PUT to ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Additional axios options
   * @returns {Promise} - API response
   */
  async delete(endpoint, options = {}) {
    try {
      return this.client.delete(endpoint, options);
    } catch (error) {
      logger.error(`Error in DELETE to ${endpoint}`, error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const secureApi = new SecureApiClient();
export default secureApi;
