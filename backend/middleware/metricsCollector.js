const {
  httpRequestsTotal,
  httpRequestErrorsTotal,
  httpRequestDurationMs,
  normalizeRoute,
} = require("../utils/metrics");

/**
 * Records request count, error count and latency for every response.
 * Mounted before the routes so it sees the final status code via res.on("finish").
 */
const metricsCollector = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const route = normalizeRoute(req);
    const labels = { method: req.method, route };

    httpRequestsTotal.inc({ ...labels, status: res.statusCode });
    httpRequestDurationMs.observe(labels, durationMs);

    if (res.statusCode >= 400) {
      httpRequestErrorsTotal.inc({
        ...labels,
        status_class: `${Math.floor(res.statusCode / 100)}xx`,
      });
    }
  });

  next();
};

module.exports = metricsCollector;
