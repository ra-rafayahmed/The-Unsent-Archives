// Centralised error reporting seam.
//
// Every unexpected error funnels through captureException(), which logs it with
// structured context and increments a metric. Set ERROR_WEBHOOK_URL to also
// forward reports to an external collector (Sentry-style ingest, Slack webhook,
// or your own endpoint) without touching call sites.

const logger = require("./logger");
const { unhandledErrorsTotal } = require("./metrics");

const WEBHOOK_URL = process.env.ERROR_WEBHOOK_URL || "";
const WEBHOOK_TIMEOUT_MS = 2000;

// Substrings, not exact names: this also catches passwordHash, accessToken,
// refresh_token, Authorization, apiKey, and similar variants.
const SENSITIVE_KEY_PARTS = [
  "password",
  "token",
  "authorization",
  "jwt",
  "secret",
  "apikey",
  "api_key",
  "cookie",
];

/** Strip anything we should never ship off-box. */
const sanitizeContext = (context = {}) => {
  return Object.fromEntries(
    Object.entries(context).filter(([key]) => {
      const k = key.toLowerCase();
      return !SENSITIVE_KEY_PARTS.some((part) => k.includes(part));
    })
  );
};

/** Fire-and-forget forward; never blocks or throws into the request path. */
const forward = (payload) => {
  if (!WEBHOOK_URL || typeof fetch !== "function") return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch((err) => logger.debug({ err }, "error report forwarding failed"))
    .finally(() => clearTimeout(timer));
};

/**
 * Report an error.
 * @param {Error} err
 * @param {object} context   e.g. { requestId, userId, route, statusCode }
 * @param {"fatal"|"error"|"warn"} level
 */
const captureException = (err, context = {}, level = "error") => {
  const safeContext = sanitizeContext(context);
  unhandledErrorsTotal.inc({ name: err?.name || "Error" });

  logger[level]({ err, ...safeContext }, err?.message || "unhandled error");

  forward({
    name: err?.name || "Error",
    message: err?.message || String(err),
    stack: err?.stack,
    level,
    context: safeContext,
    service: "unsent-archives-api",
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  captureException,
  sanitizeContext,
  isForwardingEnabled: () => Boolean(WEBHOOK_URL),
};
