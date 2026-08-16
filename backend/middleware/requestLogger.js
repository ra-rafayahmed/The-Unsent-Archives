const morgan = require("morgan");
const config = require("../config");

// Use 'dev' format in development and 'combined' in production
const format = config.env === "production" ? "combined" : "dev";

// Silence request logs while running the test suite.
const requestLogger = morgan(format, { skip: () => config.env === "test" });

module.exports = requestLogger;
