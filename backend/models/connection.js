// db/connection.js
// Manages the MongoDB Atlas connection.
// Import this ONCE at the top of your server entry (e.g. index.js or app.js).
// Models are registered via the barrel import so all indexes are created on startup.

const mongoose = require("mongoose");
const logger = require("../utils/logger");

// Import models so Mongoose registers them (and creates indexes) on connect
require("../models");

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  logger.fatal("MONGODB_URI is not set in your .env file");
  process.exit(1);
}

const options = {
  // Connection pool: keeps 5–10 live connections ready for concurrent requests
  minPoolSize: 5,
  maxPoolSize: 10,

  // Fail fast if Atlas is unreachable on startup
  serverSelectionTimeoutMS: 5000,

  // Drop connections idle for 30s (prevents stale socket errors)
  socketTimeoutMS: 30000,
};

// ── Connect ───────────────────────────────────────────────────────────────────
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, options);
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.fatal({ err }, "MongoDB connection error");
    process.exit(1);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────
mongoose.connection.on("disconnected", () =>
  logger.warn("MongoDB disconnected — attempting reconnect...")
);

mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Closes the connection cleanly when the process receives SIGINT (Ctrl+C) or
// SIGTERM (e.g. from a Docker/Heroku shutdown signal).
async function closeDB() {
  await mongoose.connection.close();
  logger.info("MongoDB connection closed");
}

process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closeDB();
  process.exit(0);
});

module.exports = { connectDB, closeDB };
