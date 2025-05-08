# Security Implementation Guide

This document outlines the security features implemented in the Diabetick application, focusing on data encryption for both storage and transmission.

## Overview of Security Features

1. **Server-side Encryption**: Sensitive health data is encrypted before being stored in Firestore.
2. **Client-side Encryption**: Sensitive data can be encrypted before transmission to the server.
3. **Secure API Communication**: HTTPS enforcement and secure headers.
4. **Multi-Factor Authentication**: Existing MFA implementation enhanced with secure transmission.

## Setup Instructions

### Backend Setup

1. Add the following environment variables to your `.env` file:

```
# Used for server-side encryption of data at rest
ENCRYPTION_KEY=your-32-character-encryption-key
# Set to 'production' in production environments
NODE_ENV=development
# For CORS configuration
FRONTEND_URL=https://your-frontend-domain.com
```

2. Generate a secure encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Install dependencies:

```bash
cd backend
npm install
```

### Frontend Setup

1. Add the following environment variables to your `.env` file:

```
# Used for client-side encryption of data in transit
REACT_APP_CLIENT_ENCRYPTION_KEY=your-client-encryption-key
```

2. Generate a secure client encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

3. Install dependencies:

```bash
cd frontend
npm install
```

## Using the Secure API Client

The frontend includes a secure API client that handles:

- Automatic authentication token management
- MFA token handling
- Data encryption for sensitive information

Example usage:

```javascript
import secureApi from "../utils/secureApi";

// Regular GET request
const getData = async () => {
  const response = await secureApi.get("/endpoint");
  return response.data;
};

// POST with selective field encryption
const postData = async (data) => {
  const response = await secureApi.securePost("/endpoint", data, [
    "sensitiveField1",
    "sensitiveField2",
  ]);
  return response.data;
};

// POST with complete payload encryption
const postSensitiveData = async (data) => {
  const response = await secureApi.securePost(
    "/endpoint",
    data,
    ["*"] // Encrypt entire payload
  );
  return response.data;
};
```

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files to version control.
2. **Key Rotation**: Regularly rotate encryption keys (requires data re-encryption).
3. **Firestore Rules**: Ensure Firestore security rules are properly configured.
4. **Updates**: Keep all dependencies updated to address security vulnerabilities.
5. **Logging**: Monitor for suspicious activities in logs.

## How Encryption Works

### Data at Rest (Firestore)

- Sensitive health data is encrypted using AES-256-CBC before storage.
- Each record has a unique Initialization Vector (IV) for added security.
- Metadata like timestamps and user IDs remain unencrypted for query functionality.

### Data in Transit

- HTTPS is enforced in production.
- Client-side encryption adds an additional layer of protection.
- Sensitive data is encrypted before leaving the client.
- The server decrypts data using the decryption middleware.

## Security Considerations

- The encryption system is designed to protect against data breaches and unauthorized access.
- It is not designed to protect against compromised application servers or key theft.
- For highest security, consider using a dedicated key management service in production.
