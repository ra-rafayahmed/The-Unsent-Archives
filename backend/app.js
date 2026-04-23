const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const requestLogger = require("./middleware/requestLogger");
const rateLimiter = require("./middleware/rateLimiter");
const routes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");
const ApiError = require("./utils/ApiError");

const app = express();

// 1. Security & Utility Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Logging
app.use(requestLogger);

// 3. Rate Limiting
app.use(rateLimiter.globalLimiter);

// 4. API Routes
app.use("/api", routes);

// 5. 404 Handler for undefined routes
app.use((req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// 6. Global Error Handler
app.use(errorHandler);

module.exports = app;
