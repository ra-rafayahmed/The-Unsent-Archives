// db/connection.js
// Manages the MongoDB Atlas connection.
// Import this ONCE at the top of your server entry (e.g. index.js or app.js).
// Models are registered via the barrel import so all indexes are created on startup.

const mongoose = require("mongoose");

// Import models so Mongoose registers them (and creates indexes) on connect
require("../models");

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI is not set in your .env file");
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
    console.log("🍃 Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌  MongoDB connection error:", err.message);
    process.exit(1);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────
mongoose.connection.on("disconnected", () =>
  console.warn("⚠️   MongoDB disconnected — attempting reconnect...")
);

mongoose.connection.on("reconnected", () =>
  console.log("🔁 MongoDB reconnected")
);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Closes the connection cleanly when the process receives SIGINT (Ctrl+C) or
// SIGTERM (e.g. from a Docker/Heroku shutdown signal).
async function closeDB() {
  await mongoose.connection.close();
  console.log("🛑 MongoDB connection closed");
}

process.on("SIGINT",  async () => { await closeDB(); process.exit(0); });
process.on("SIGTERM", async () => { await closeDB(); process.exit(0); });

module.exports = { connectDB, closeDB };
