const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const config = require("../config");

// Middleware to protect routes
const auth = (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ApiError(401, "Not authorized to access this route"));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Add user from payload
    req.user = decoded;
    next();
  } catch (err) {
    return next(new ApiError(401, "Token is invalid or expired"));
  }
};

module.exports = { auth };
