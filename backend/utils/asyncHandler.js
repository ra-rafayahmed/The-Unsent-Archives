// @ts-check
/**
 * Wrap an async route handler so a rejected promise reaches the global error
 * handler instead of becoming an unhandled rejection.
 *
 * @param {(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => unknown} fn
 * @returns {import("express").RequestHandler}
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
