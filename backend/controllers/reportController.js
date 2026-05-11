const { Report, Post, User } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate",
  "self-harm",
  "nsfw",
  "impersonation",
  "other",
];

// @desc    File a report against a post or user
// @route   POST /api/reports
// @access  Private
const createReport = asyncHandler(async (req, res, next) => {
  const { targetType, targetId, reason, note } = req.body;

  if (!["post", "user"].includes(targetType)) {
    return next(new ApiError(400, "targetType must be 'post' or 'user'"));
  }
  if (!REPORT_REASONS.includes(reason)) {
    return next(new ApiError(400, "Invalid report reason"));
  }
  if (!targetId) {
    return next(new ApiError(400, "targetId is required"));
  }

  // Verify the target exists and is not the reporter themselves
  if (targetType === "user") {
    if (targetId === req.user.id) {
      return next(new ApiError(400, "You cannot report yourself"));
    }
    const exists = await User.exists({ _id: targetId });
    if (!exists) return next(new ApiError(404, "User not found"));
  } else {
    const post = await Post.findById(targetId).select("authorId");
    if (!post) return next(new ApiError(404, "Post not found"));
    if (post.authorId.toString() === req.user.id) {
      return next(new ApiError(400, "You cannot report your own post"));
    }
  }

  // Soft de-dupe: don't let one user spam-file the same open report
  const existing = await Report.findOne({
    reporterId: req.user.id,
    targetType,
    targetId,
    status: "open",
  });
  if (existing) {
    return res.status(200).json({
      status: "success",
      message: "Report already filed and pending review",
      report: existing,
    });
  }

  const report = await Report.create({
    reporterId: req.user.id,
    targetType,
    targetId,
    reason,
    note: (note || "").slice(0, 500),
  });

  res.status(201).json({
    status: "success",
    message: "Thank you. Our admins will review this shortly.",
    report,
  });
});

const listReasons = (req, res) => {
  res.status(200).json({ status: "success", reasons: REPORT_REASONS });
};

module.exports = {
  createReport,
  listReasons,
};
