// @ts-check
// Single place that understands the API's error shape.
//
// The backend always answers failures with
//   { status: "fail" | "error", statusCode, message }
// so components should not each re-derive `err?.response?.data?.message`.

/**
 * The shape we care about from an axios rejection.
 * @typedef {{ response?: { status?: number, data?: { message?: unknown } } }} ApiFailure
 */

/**
 * HTTP status of a failed request, or 0 when the request never got a response.
 * @param {ApiFailure|Error|unknown} err
 * @returns {number}
 */
export const getStatus = (err) => /** @type {ApiFailure} */ (err)?.response?.status ?? 0;

/**
 * True when the request never reached the server (offline, DNS, CORS, abort).
 * @param {ApiFailure|Error|unknown} err
 * @returns {boolean}
 */
export const isNetworkError = (err) => Boolean(err) && !(/** @type {ApiFailure} */ (err).response);

/** @param {ApiFailure|Error|unknown} err @returns {boolean} */
export const isUnauthorized = (err) => getStatus(err) === 401;
/** @param {ApiFailure|Error|unknown} err @returns {boolean} */
export const isForbidden = (err) => getStatus(err) === 403;
/** @param {ApiFailure|Error|unknown} err @returns {boolean} */
export const isNotFound = (err) => getStatus(err) === 404;
/**
 * Server-side failure — worth reporting rather than showing as user error.
 * @param {ApiFailure|Error|unknown} err
 * @returns {boolean}
 */
export const isServerError = (err) => getStatus(err) >= 500;

/**
 * A message safe to render to the user.
 * Prefers the API's own message, then a status-specific default, then `fallback`.
 *
 * @param {ApiFailure|Error|unknown} err   the caught error (usually from axios)
 * @param {string} [fallback]              what to say when nothing better exists
 * @returns {string}
 */
export const toUserMessage = (err, fallback = "Something went wrong. Please try again.") => {
  const apiMessage = /** @type {ApiFailure} */ (err)?.response?.data?.message;
  if (typeof apiMessage === "string" && apiMessage.trim()) return apiMessage.trim();

  if (isNetworkError(err)) return "Cannot reach the server. Check your connection and try again.";

  switch (getStatus(err)) {
    case 401:
      return "Please sign in to continue.";
    case 403:
      return "You do not have access to this.";
    case 404:
      return "That is no longer here.";
    case 409:
      return "That conflicts with something that already exists.";
    case 413:
      return "That file is too large.";
    case 429:
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return isServerError(err) ? "The server had a problem. Please try again shortly." : fallback;
  }
};

/**
 * Normalised error object for components that want more than a string.
 * @returns {{message: string, status: number, isNetwork: boolean, isServer: boolean}}
 */
/**
 * @param {ApiFailure|Error|unknown} err
 * @param {string} [fallback]
 */
export const toApiError = (err, fallback) => ({
  message: toUserMessage(err, fallback),
  status: getStatus(err),
  isNetwork: isNetworkError(err),
  isServer: isServerError(err),
});
