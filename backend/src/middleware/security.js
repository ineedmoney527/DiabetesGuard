const cors = require("cors");
const helmet = require("helmet");
const { logger } = require("../utils/logger");

/**
 * Configure security middleware for Express
 * @param {Express} app - Express app instance
 * @param {boolean} isDevelopment - Whether app is in development mode
 */
const configureSecurityMiddleware = (app, isDevelopment = false) => {
  // Configure CORS settings with wildcard to fix the current issue
  // This is a temporary fix to allow all origins
  const corsOptions = {
    origin: "*", // Allow all origins temporarily to fix the CORS issue
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-TOTP-Code"],
    credentials: true,
    maxAge: 86400, // 24 hours
  };

  // Log CORS configuration
  logger.info("CORS configuration applied", { corsOptions });

  // Apply CORS globally for all routes
  app.use(cors(corsOptions));

  // Handle OPTIONS requests explicitly
  app.options("*", cors(corsOptions));

  // Apply helmet security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // May need to adjust based on requirements
          connectSrc: isDevelopment
            ? ["'self'", "http://localhost:*", "ws://localhost:*"]
            : [
                "'self'",
                process.env.FRONTEND_URL,
                "https://diabetes-frontend-894934581965.us-central1.run.app",
              ],
          imgSrc: ["'self'", "data:"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      // Set strict transport security header
      hsts: {
        maxAge: 15552000, // 180 days in seconds
        includeSubDomains: true,
        preload: true,
      },
      // Prevent browsers from incorrectly detecting non-scripts as scripts
      noSniff: true,
      // Disable iframe usage
      frameguard: {
        action: "deny",
      },
      // Disable X-Powered-By header
      hidePoweredBy: true,
    })
  );

  // Force HTTPS in production
  if (!isDevelopment) {
    app.use((req, res, next) => {
      if (req.headers["x-forwarded-proto"] !== "https") {
        return res.redirect(`https://${req.hostname}${req.url}`);
      }
      next();
    });
  }

  // Add middleware to set secure cookies
  app.use((req, res, next) => {
    res.cookie = function (name, value, options = {}) {
      const secureOptions = {
        ...options,
        httpOnly: true,
        secure: !isDevelopment,
        sameSite: "strict",
      };
      return res.__proto__.cookie.call(this, name, value, secureOptions);
    };
    next();
  });
};

module.exports = { configureSecurityMiddleware };
