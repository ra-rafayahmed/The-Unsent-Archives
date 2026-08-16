const rateLimit = require("express-rate-limit");
const config = require("../config");

// Rate limits are disabled in the test environment so that integration
// suites can hammer the auth endpoints without tripping the limiter.
const skip = () => config.env === "test";

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per 15 mins
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth requests per 15 mins
  message: "Too many authentication attempts, please try again later",
  skip,
});

module.exports = {
  globalLimiter,
  authLimiter,
};
