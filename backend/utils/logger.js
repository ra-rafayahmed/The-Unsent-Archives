// Structured application logger (pino).
// - development: pretty-printed, human friendly
// - production:  newline-delimited JSON for log shippers
// - test:        silent, so suites stay readable
const pino = require("pino");
const config = require("../config");

const level =
  process.env.LOG_LEVEL ||
  (config.env === "test" ? "silent" : config.env === "production" ? "info" : "debug");

const transport =
  config.env === "development"
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
      }
    : undefined;

const logger = pino({
  level,
  base: { service: "unsent-archives-api" },
  redact: {
    paths: ["req.headers.authorization", "*.password", "*.passwordHash", "*.token"],
    remove: true,
  },
  ...(transport && { transport }),
});

module.exports = logger;
