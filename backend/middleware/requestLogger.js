const pinoHttp = require("pino-http");
const logger = require("../utils/logger");

// Structured per-request logging. Silent under test (logger level = silent).
const requestLogger = pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === "/api/health" },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url, id: req.id }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

module.exports = requestLogger;
