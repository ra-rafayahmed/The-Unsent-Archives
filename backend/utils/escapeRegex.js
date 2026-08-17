// Escape a user-supplied string so it matches literally inside a RegExp or a
// Mongo `$regex`. Without this, a query like `?user=.*` becomes a wildcard and
// `?q=(` makes MongoDB reject the whole query with a 500.
const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

const escapeRegex = (value) => String(value ?? "").replace(REGEX_METACHARACTERS, "\\$&");

module.exports = { escapeRegex, REGEX_METACHARACTERS };
