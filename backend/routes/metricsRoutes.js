const express = require("express");
const { registry, processMetrics } = require("../utils/metrics");

const router = express.Router();

// @desc    Prometheus metrics scrape endpoint
// @route   GET /api/metrics
// @access  Public (put it behind your ingress/network policy in production)
router.get("/", (req, res) => {
  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.status(200).send(`${registry.render()}${processMetrics()}`);
});

module.exports = router;
