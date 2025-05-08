const { decrypt } = require("../utils/encryption");

/**
 * Middleware to decrypt encrypted requests from frontend
 * Checks for encryptedPayload field and decrypts it if present
 */
const decryptRequestBody = (req, res, next) => {
  try {
    // Check if request body contains encryptedPayload
    if (req.body && req.body.encryptedPayload) {
      // Decrypt the payload
      const decryptedData = decrypt(req.body.encryptedPayload);

      // Replace request body with decrypted data
      req.body = decryptedData;

      // Add a flag to indicate this request was encrypted
      req.wasEncrypted = true;
    }

    next();
  } catch (error) {
    console.error("Error decrypting request body:", error);
    return res.status(400).json({
      success: false,
      message: "Invalid encrypted payload",
    });
  }
};

module.exports = { decryptRequestBody };
