# Application Security Documentation

This document outlines the key security measures implemented within the Diabetick application to protect user data and ensure secure operation.

## 1. User Authentication and Authorization

Authentication (verifying user identity) and Authorization (controlling user access) are handled through a combination of Firebase Authentication and custom backend logic.

- **Authentication Provider:** Firebase Authentication is used for core authentication processes, including user registration (email/password), sign-in, password management, and email verification. Firebase securely handles password storage and verification using industry-standard hashing algorithms.
- **Session Management:** Upon successful login, Firebase Authentication provides a JSON Web Token (JWT). This token is securely transmitted to the client and stored in `localStorage`.
- **API Authentication:** All protected backend API endpoints require a valid JWT, passed in the `Authorization: Bearer <token>` header. Backend middleware (`verifyToken`) validates this token on each request, ensuring the user is authenticated.
- **Multi-Factor Authentication (MFA):** An additional layer of security is provided via Time-based One-Time Passwords (TOTP). If MFA is enabled for a user account:
  - After initial password verification, the user is prompted for a TOTP code.
  - This code is sent in the `X-TOTP-Code` header on subsequent API requests within the MFA-verified session.
  - Backend middleware (`verifyMfaIfEnabled`) validates this code where necessary.
- **Authorization Logic:** Authorization is implemented at two levels:
  - **API Route Level:** Backend middleware (e.g., `isAdmin`, `isDoctor`) checks the user's role (obtained from the validated JWT or Firestore) before granting access to specific API routes.
  - **Data Level:** Firestore Security Rules provide fine-grained access control directly at the database level, ensuring users can only read/write data according to their role and ownership (e.g., a user can access their own health data, while doctors/admins may have broader read access).

## 2. Secure Communication Protocols

Ensuring data is protected during transmission between the client (browser/mobile app) and the backend server is critical.

- **HTTPS Enforcement:** In production environments, the application enforces HTTPS-only connections. The backend redirects any HTTP requests to HTTPS using `Strict-Transport-Security` (HSTS) headers configured via the `helmet` middleware. This prevents downgrade attacks and ensures communication is encrypted using TLS/SSL.
- **Secure Headers:** The `helmet` middleware is employed to set various HTTP security headers, mitigating common web vulnerabilities:
  - `Content-Security-Policy` (CSP): Restricts the sources from which content (scripts, styles, etc.) can be loaded.
  - `X-Content-Type-Options: nosniff`: Prevents browsers from MIME-sniffing responses away from the declared content type.
  - `X-Frame-Options: DENY`: Prevents the site from being embedded within iframes, mitigating clickjacking attacks.
  - `Strict-Transport-Security` (HSTS): Enforces HTTPS.
  - `X-XSS-Protection`: Enables browser-level cross-site scripting filters (though largely superseded by CSP).
  - `Referrer-Policy`: Controls how much referrer information is sent.
  - `Expect-CT`: Helps detect and mitigate certificate misissuance.
- **CORS Configuration:** Cross-Origin Resource Sharing (CORS) is carefully configured to only allow requests from trusted frontend origins specified in environment variables.
- **Secure Cookies:** Any cookies set by the application are configured with `HttpOnly`, `Secure` (in production), and `SameSite=Strict` flags to prevent access from client-side scripts and mitigate cross-site request forgery (CSRF) attacks.

## 3. Role-Based Access Control (RBAC)

The application implements RBAC to ensure users only have access to the data and functionality relevant to their role (e.g., patient, doctor, admin).

- **Role Definition:** User roles are defined and stored within the user's profile in the Firestore database.
- **Enforcement:** As mentioned in the Authorization section, RBAC is enforced through:
  - **Backend API Middleware:** Protecting routes based on role checks.
  - **Firestore Security Rules:** Defining data access permissions based on the authenticated user's role and the data being accessed.

## 4. Secure Handling of Sensitive Data

Protecting sensitive user data, particularly health information, is paramount. Security measures cover data both during storage (at rest) and during transmission (in transit).

- **Encryption at Rest:**
  - **Mechanism:** Sensitive data fields within Firestore documents (e.g., user profile details, health records, prescription details) are encrypted _before_ being saved to the database.
  - **Algorithm:** AES-256-CBC is used for encryption, implemented via Node.js `crypto` module (`backend/src/utils/encryption.js`).
  - **Key Management:** A strong encryption key (`ENCRYPTION_KEY`) is required, stored securely as an environment variable on the backend server. This key is hashed using SHA-256 to ensure the correct length for AES-256. The application code _never_ stores the raw key.
  - **Initialization Vector (IV):** A unique, cryptographically random IV is generated for each encryption operation and stored alongside the encrypted data (prepended with a separator). This ensures that identical plaintext values encrypt to different ciphertext values, enhancing security.
  - **Decryption:** Data is decrypted on the backend only when necessary to fulfill an authorized user request.
- **Encryption in Transit:**
  - **Primary Layer (TLS/SSL):** All communication is encrypted via HTTPS (see Section 2).
  - **Secondary Layer (Client-Side Encryption):** For an _additional_ layer of security, the frontend application (`frontend/src/utils/secureApi.js`) can optionally encrypt specific sensitive fields or entire API request payloads _before_ sending them to the backend, even over HTTPS.
    - **Mechanism:** CryptoJS library (AES) is used on the client-side.
    - **Key Management:** A separate client-side encryption key (`REACT_APP_CLIENT_ENCRYPTION_KEY`) is used, managed via frontend environment variables.
    - **Backend Decryption:** Specific backend middleware (`backend/src/middleware/encryption.js`) automatically detects and decrypts these client-encrypted payloads upon arrival at the server, using the server-side encryption utility and the `ENCRYPTION_KEY`.
- **Data Minimization:** Only necessary data is requested and stored. Sensitive data is decrypted only when required for processing or display to an authorized user.
- **Password Security:** User passwords are not stored directly. Firebase Authentication handles secure password hashing and verification.
- **Token Security:** JWTs used for session management have a limited expiry time and are transmitted securely via HTTPS.

## Security Best Practices Adherence

- **Dependency Management:** Regularly update dependencies (npm packages) to patch known vulnerabilities.
- **Environment Variables:** Sensitive configuration (API keys, encryption keys) is managed via environment variables and is _not_ committed to version control.
- **Input Validation:** Implement server-side validation for all user inputs to prevent injection attacks. (Note: While not explicitly detailed in the provided code snippets, this is a standard best practice assumed to be followed).
- **Logging:** Maintain appropriate logging for security events, monitoring for suspicious activities (handled partly by Firebase and potentially custom logging).

This documentation provides a high-level overview. Specific implementation details can be found within the referenced source code files.
