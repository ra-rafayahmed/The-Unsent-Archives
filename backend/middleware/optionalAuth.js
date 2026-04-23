const jwt = require("jsonwebtoken");
const config = require("../config");

// Soft auth: decodes JWT if present but doesn't throw if missing/invalid
const optionalAuth = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
  } catch (err) {
    req.user = null; // Invalid token is ignored, falls back to unauthenticated
  }

  next();
};

module.exports = { optionalAuth };
