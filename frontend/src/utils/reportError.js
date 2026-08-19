// @ts-check
// Client-side mirror of backend/utils/errorReporter.js.
//
// Every unexpected client error funnels through reportError(), which normalises
// it, strips anything sensitive from the context, and always logs it. Set
// VITE_ERROR_ENDPOINT at build time to also POST the sanitised report to a
// collector — no call site changes, and no third-party SDK.
//
// Nothing here may throw or block: a broken reporter must never be the reason a
// page stays broken.

/**
 * Free-form detail attached to a report — e.g. `{ source, componentStack, route }`.
 * Keys whose name looks sensitive are dropped before the report leaves the browser.
 * @typedef {Record<string, unknown>} ErrorContext
 */

/**
 * The exact JSON body POSTed to `VITE_ERROR_ENDPOINT`.
 * @typedef {object} ErrorReport
 * @property {string} name        error constructor name, e.g. "TypeError"
 * @property {string} message     error message ("" when there is none)
 * @property {string} stack       stack trace ("" when unavailable)
 * @property {ErrorContext} context  sanitised context
 * @property {string} app         always "unsent-archives-web"
 * @property {string} url         `location.href` at the time of the error
 * @property {string} userAgent   `navigator.userAgent` ("" when unavailable)
 * @property {string} timestamp   ISO-8601 capture time
 */

/** Where the error came from. @typedef {"render"|"window"|"unhandledrejection"|string} ErrorSource */

const APP = "unsent-archives-web";

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

/**
 * Drop context keys we should never ship off-device.
 * @param {ErrorContext} [context]
 * @returns {ErrorContext}
 */
export const sanitizeContext = (context = {}) =>
  Object.fromEntries(
    Object.entries(context).filter(([key]) => {
      const k = key.toLowerCase();
      return !SENSITIVE_KEY_PARTS.some((part) => k.includes(part));
    })
  );

/**
 * Coerce anything throwable — Error, string, DOM event reason, `undefined` —
 * into the three fields a report needs.
 * @param {unknown} error
 * @returns {{ name: string, message: string, stack: string }}
 */
const normalize = (error) => {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "",
      stack: typeof error.stack === "string" ? error.stack : "",
    };
  }

  if (error && typeof error === "object") {
    const bag = /** @type {{ name?: unknown, message?: unknown, stack?: unknown }} */ (error);
    const message = typeof bag.message === "string" ? bag.message : safeString(error);
    return {
      name: typeof bag.name === "string" && bag.name ? bag.name : "Error",
      message,
      stack: typeof bag.stack === "string" ? bag.stack : "",
    };
  }

  return { name: "Error", message: safeString(error), stack: "" };
};

/**
 * `String(value)` that survives objects with a throwing `toString`.
 * @param {unknown} value
 * @returns {string}
 */
const safeString = (value) => {
  try {
    return String(value);
  } catch {
    return "Unknown error";
  }
};

/** @returns {string} the current path, or "" outside a browser. */
const currentRoute = () => {
  try {
    return window.location.pathname + window.location.search;
  } catch {
    return "";
  }
};

/**
 * Configured collector endpoint, read lazily so a build-time env change (or a
 * test stub) is picked up without re-importing this module.
 * @returns {string}
 */
const endpoint = () => {
  const configured = import.meta.env?.VITE_ERROR_ENDPOINT;
  return typeof configured === "string" ? configured.trim() : "";
};

/**
 * Fire-and-forget transport. Prefers sendBeacon (survives page unload), falls
 * back to a keepalive fetch. Never throws, never awaited.
 * @param {string} url
 * @param {ErrorReport} report
 * @returns {void}
 */
const send = (url, report) => {
  /** @type {string} */
  let body;
  try {
    body = JSON.stringify(report);
  } catch {
    return; // context held something non-serialisable; drop the report, not the page
  }

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    // fall through to fetch
  }

  try {
    if (typeof fetch !== "function") return;
    const pending = fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
    // A rejected transport is not the page's problem.
    if (pending && typeof pending.catch === "function") pending.catch(() => {});
  } catch {
    // swallow: reporting must never surface as a new error
  }
};

/**
 * Report an error. Always logs; additionally POSTs a sanitised JSON report when
 * `VITE_ERROR_ENDPOINT` is configured. Safe to call from anywhere — it never
 * throws and never blocks.
 *
 * @param {unknown} error       the caught error (or rejection reason)
 * @param {ErrorContext} [context]  e.g. `{ source: "render", componentStack, route }`
 * @returns {void}
 */
export const reportError = (error, context = {}) => {
  try {
    const { name, message, stack } = normalize(error);
    const safeContext = sanitizeContext({ route: currentRoute(), ...context });

    // Always on: a client crash is worth a console record even in production,
    // where source maps make the stack and component stack readable.
    console.error(`[${APP}] ${name}: ${message}`, error, safeContext);

    const url = endpoint();
    if (!url) return;

    send(url, {
      name,
      message,
      stack,
      context: safeContext,
      app: APP,
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent || "" : "",
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Reporting an error must never itself become an error.
  }
};

/** Uninstall function for the currently installed handlers, or null. @type {(() => void)|null} */
let uninstall = null;

/**
 * Register `window` handlers for uncaught errors and unhandled promise
 * rejections. Idempotent: calling it again while installed adds no second
 * listener and returns the same uninstall function.
 *
 * @returns {() => void} removes the handlers (safe to call more than once)
 */
export const installGlobalErrorHandlers = () => {
  if (uninstall) return uninstall;

  /** @param {Event} event */
  const onError = (event) => {
    const e = /** @type {ErrorEvent} */ (event);
    reportError(e.error ?? e.message ?? "Uncaught error", {
      source: "window",
      filename: e.filename || "",
      lineno: e.lineno ?? 0,
      colno: e.colno ?? 0,
    });
  };

  /** @param {Event} event */
  const onRejection = (event) => {
    const e = /** @type {PromiseRejectionEvent} */ (event);
    reportError(e.reason ?? "Unhandled promise rejection", { source: "unhandledrejection" });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  /** @returns {void} */
  const teardown = () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    // Only clear the slot if these are still the installed handlers, so a stale
    // uninstall from an earlier cycle cannot orphan a later installation.
    if (uninstall === teardown) uninstall = null;
  };

  uninstall = teardown;
  return teardown;
};

/** @returns {boolean} true when reports are forwarded to a collector. */
export const isReportingEnabled = () => Boolean(endpoint());
