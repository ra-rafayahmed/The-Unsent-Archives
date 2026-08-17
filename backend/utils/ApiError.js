// @ts-check
/**
 * An error the API deliberately produced, carrying the status to answer with.
 * Anything else reaching the error handler is treated as a 500 incident.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode  HTTP status to send
   * @param {string} message     message safe to show the caller
   */
  constructor(statusCode, message) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
