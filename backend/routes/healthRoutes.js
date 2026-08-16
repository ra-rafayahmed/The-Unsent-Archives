const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const STATES = ["disconnected", "connected", "connecting", "disconnecting"];

// @desc    Liveness / readiness probe
// @route   GET /api/health
// @access  Public
router.get("/", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbOk = dbState === 1;
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    service: "unsent-archives-api",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    db: { state: STATES[dbState] || "unknown", connected: dbOk },
  });
});

module.exports = router;
