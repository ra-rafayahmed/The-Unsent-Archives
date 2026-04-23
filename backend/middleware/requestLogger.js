const morgan = require("morgan");
const config = require("../config");

// Use 'dev' format in development and 'combined' in production
const format = config.env === "production" ? "combined" : "dev";

const requestLogger = morgan(format);

module.exports = requestLogger;
