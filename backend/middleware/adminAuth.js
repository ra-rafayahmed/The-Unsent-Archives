const { User } = require("../models");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const requireAdmin = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("role isActive");

  if (!user || !user.isActive) {
    return next(new ApiError(403, "Admin access denied"));
  }

  if (user.role !== "admin") {
    return next(new ApiError(403, "Admin access denied"));
  }

  next();
});

module.exports = { requireAdmin };
