// Reusable pagination logic.
//
// Query strings are untrusted: `?page=-5` previously produced a negative skip,
// which MongoDB rejects and turned into a 500 on every paginated endpoint.
// Everything here is clamped to a usable range instead.

/**
 * @param {string|number} pageStr    requested page (1-based)
 * @param {string|number} limitStr   requested page size
 * @param {number} defaultLimit      page size when none/invalid is supplied
 * @param {number} maxLimit          hard ceiling on page size
 * @returns {{page: number, limit: number, skip: number}}
 */
const getPagination = (pageStr, limitStr, defaultLimit = 20, maxLimit = 100) => {
  const parse = (value, fallback) => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
  };

  // Anything below 1 (negative, zero, NaN) falls back to a sane value rather
  // than reaching the driver.
  let page = parse(pageStr, 1);
  if (page < 1) page = 1;

  let limit = parse(limitStr, defaultLimit);
  if (limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

module.exports = {
  getPagination,
};
