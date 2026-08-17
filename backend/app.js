const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const requestLogger = require("./middleware/requestLogger");
const metricsCollector = require("./middleware/metricsCollector");
const rateLimiter = require("./middleware/rateLimiter");
const routes = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");
const ApiError = require("./utils/ApiError");

const app = express();

// We sit behind a reverse proxy (nginx in docker compose / most PaaS hosts);
// trust the first hop so req.ip and the rate limiter see the real client IP.
app.set("trust proxy", 1);

// 1. Security & Utility Middlewares
// Allow images/audio served from /api/uploads/:id/file to embed cross-origin
// (frontend at :3000 reading from API at :5000), otherwise helmet's default
// `same-origin` CORP blocks media loading in the browser.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors());
// Increase JSON body limit slightly for posts that include media metadata.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// 2. Logging
app.use(requestLogger);

// 3. Metrics (records every response, including rate-limited ones)
app.use(metricsCollector);

// 4. Rate Limiting
app.use(rateLimiter.globalLimiter);

// 5. API Routes
app.use("/api", routes);

// 6. 404 Handler for undefined routes
app.use((req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// 7. Global Error Handler
app.use(errorHandler);

module.exports = app;
