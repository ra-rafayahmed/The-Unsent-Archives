// @ts-check
// Client-side mirrors of the backend Joi schemas.
//
// The API is still the authority — every mutating route re-validates with Joi
// (`backend/validators/*`, applied via `backend/middleware/validate.js`). These
// rules exist so the obvious mistakes (short password, mismatched confirmation,
// malformed email, over-long note) are caught before a round-trip, and so the
// user reads a sentence we wrote rather than a raw API message.
//
// Keep the limits below in step with:
//   backend/validators/authValidator.js  — username 3-30 /^[a-zA-Z0-9_]+$/, email, password min 6
//   backend/validators/postValidator.js  — content 1-5000, tags /^[a-zA-Z0-9-]+$/ max 10
//
// Every validator is pure and returns `null` when the value is acceptable, or a
// human-readable message when it is not.

/** Shortest username the API accepts. */
export const USERNAME_MIN = 3;
/** Longest username the API accepts. */
export const USERNAME_MAX = 30;
/** Shortest password the API accepts. */
export const PASSWORD_MIN = 6;
/** Longest note body the API accepts. */
export const NOTE_MAX = 5000;
/** Most tags the API accepts on a single note. */
export const TAGS_MAX = 10;

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const TAG_PATTERN = /^[a-zA-Z0-9-]+$/;
// Deliberately looser than Joi's IANA TLD list and stricter than `type="email"`:
// enough to catch the typos worth catching without rejecting a real address.
const EMAIL_PATTERN = /^[^\s@]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

/**
 * Coerce whatever a form handed us into a string we can measure.
 * Non-strings (and `null`/`undefined`) become "" so they read as "missing".
 * @param {unknown} value
 * @returns {string}
 */
const asString = (value) => (typeof value === "string" ? value : "");

/**
 * A username: 3-30 characters, letters/numbers/underscores only.
 * @param {unknown} value
 * @returns {string|null} `null` when valid
 */
export const validateUsername = (value) => {
  const username = asString(value).trim();
  if (!username) return "Username is required";
  if (username.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters`;
  if (username.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters`;
  if (!USERNAME_PATTERN.test(username))
    return "Username can only contain letters, numbers, and underscores";
  return null;
};

/**
 * An email address.
 * @param {unknown} value
 * @returns {string|null} `null` when valid
 */
export const validateEmail = (value) => {
  const email = asString(value).trim();
  if (!email) return "Email is required";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address";
  return null;
};

/**
 * A password: at least 6 characters. Not trimmed — spaces inside a password are
 * the user's business — but an entirely blank one is treated as missing.
 * @param {unknown} value
 * @returns {string|null} `null` when valid
 */
export const validatePassword = (value) => {
  const password = asString(value);
  if (!password.trim()) return "Password is required";
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  return null;
};

/**
 * The "confirm password" field, checked against the password itself.
 * @param {unknown} password     what was typed in the password field
 * @param {unknown} confirmation what was typed in the confirmation field
 * @returns {string|null} `null` when valid
 */
export const validatePasswordConfirmation = (password, confirmation) => {
  const confirm = asString(confirmation);
  if (!confirm) return "Please confirm your password";
  if (asString(password) !== confirm) return "Passwords do not match";
  return null;
};

/**
 * A note body: 1-5000 characters.
 * @param {unknown} value
 * @returns {string|null} `null` when valid
 */
export const validateNoteContent = (value) => {
  const content = asString(value);
  if (!content.trim()) return "Write something before you archive it";
  if (content.length > NOTE_MAX) return `Note must be at most ${NOTE_MAX} characters`;
  return null;
};

/**
 * A note's tags: at most 10, each alphanumeric-or-hyphen.
 * @param {unknown} value an array of tag strings (anything else is "no tags")
 * @returns {string|null} `null` when valid
 */
export const validateTags = (value) => {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) return "Tags must be a list";
  if (value.length > TAGS_MAX) return `You can add at most ${TAGS_MAX} tags`;
  for (const tag of value) {
    const trimmed = asString(tag).trim();
    if (!trimmed) return "Tags cannot be empty";
    if (!TAG_PATTERN.test(trimmed))
      return "Tags can only contain alphanumeric characters and hyphens";
  }
  return null;
};

/**
 * One field's rule. Receives that field's value plus the whole form, so a rule
 * can compare fields (a password confirmation, for instance).
 * @typedef {(value: unknown, values: Record<string, unknown>) => string|null} FieldRule
 */

/**
 * Run a map of rules over a form's values.
 *
 * @example
 * const errors = validateForm(form, {
 *   username: validateUsername,
 *   confirm: (value, values) => validatePasswordConfirmation(values.password, value),
 * });
 * if (Object.keys(errors).length) return; // don't call the API
 *
 * @param {Record<string, unknown>} values
 * @param {Record<string, FieldRule>} rules
 * @returns {Record<string, string>} `{ field: message }`, empty when everything passes
 */
export const validateForm = (values, rules) => {
  /** @type {Record<string, string>} */
  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const message = rule(values[field], values);
    if (message) errors[field] = message;
  }
  return errors;
};
