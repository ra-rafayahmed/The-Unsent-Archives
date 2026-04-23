const config = require("../config");

const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  // Default to 500 if unknown error object
  if (!statusCode) statusCode = 500;
  
  // Handle mongoose errors (validation, duplicate keys, cast errors)
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(", ");
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = `Duplicate field value entered`;
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = `Resource not found with that ID`;
  }

  res.status(statusCode).json({
    status: statusCode.toString().startsWith("4") ? "fail" : "error",
    statusCode,
    message,
    ...(config.env === "development" && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
