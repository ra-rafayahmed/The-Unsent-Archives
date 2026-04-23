const dotenv = require("dotenv");

// Load env vars if we are not in production (where they are injected by host)
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

module.exports = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
  db: {
    uri: process.env.MONGODB_URI,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
};
