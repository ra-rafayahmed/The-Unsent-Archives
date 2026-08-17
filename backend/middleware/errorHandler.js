const config = require("../config");
const { captureException } = require("../utils/errorReporter");
const { normalizeRoute } = require("../utils/metrics");

const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  // Default to 500 if unknown error object
  if (!statusCode) statusCode = 500;

  // Handle mongoose errors (validation, duplicate keys, cast errors)
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = `Duplicate field value entered`;
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = `Resource not found with that ID`;
  }

  if (err.name === "MulterError") {
    statusCode = 400;

    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File too large. Max upload size is 15MB";
    } else {
      message = "Upload failed";
    }
  }

  // Unexpected failures go to the reporter; expected 4xx answers do not.
  if (statusCode >= 500) {
    captureException(err, {
      route: normalizeRoute(req),
      method: req.method,
      statusCode,
      requestId: req.id,
      userId: req.user?.id,
    });
  }

  res.status(statusCode).json({
    status: statusCode.toString().startsWith("4") ? "fail" : "error",
    statusCode,
    message,
    ...(config.env === "development" && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
