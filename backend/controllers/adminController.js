const crypto = require("crypto");
const {
  User,
  Post,
  Reaction,
  AnalyticsEvent,
  SearchIndex,
  Collection,
  Follow,
  MediaAsset,
  Report,
} = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { hashResetToken, RESET_TOKEN_TTL_MS } = require("./authController");

// Cascade delete is also wired as a Post post-deleteOne trigger, but we keep
// this helper for callers that pass a hydrated post they want to remove
// alongside parallel cleanup of cross-collection counters.
const deletePostCascade = async (post) => {
  await post.deleteOne();
};

const listUsers = asyncHandler(async (req, res) => {
  const { sort = "recent" } = req.query;
  const sortStage =
    sort === "reports"
      ? { reportCount: -1, createdAt: -1 }
      : { createdAt: -1 };

  const users = await User.find()
    .select("username email role isActive isSuspended reportCount createdAt avatarUrl")
    .sort(sortStage)
    .limit(200);

  res.status(200).json({
    status: "success",
    results: users.length,
    users,
  });
});

const listPosts = asyncHandler(async (req, res) => {
  const { sort = "recent" } = req.query;
  const sortStage =
    sort === "reports"
      ? { reportCount: -1, createdAt: -1 }
      : { createdAt: -1 };

  const posts = await Post.find()
    .select("content authorId visibility isAnonymous createdAt reactionCount viewCount saveCount reportCount")
    .populate("authorId", "username email")
    .sort(sortStage)
    .limit(300);

  res.status(200).json({
    status: "success",
    results: posts.length,
    posts,
  });
});

const setUserRole = asyncHandler(async (req, res, next) => {
  const { role } = req.body;

  if (!["user", "admin"].includes(role)) {
    return next(new ApiError(400, "Role must be user or admin"));
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select(
    "_id username email role"
  );

  if (!user) {
    return next(new ApiError(404, "User not found"));
  }

  res.status(200).json({
    status: "success",
    user,
  });
});

const suspendUser = asyncHandler(async (req, res, next) => {
  const { suspended } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isSuspended: Boolean(suspended), isActive: !suspended },
    { new: true }
  ).select("_id username email role isActive isSuspended");

  if (!user) return next(new ApiError(404, "User not found"));
  res.status(200).json({ status: "success", user });
});

const deletePostAsAdmin = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new ApiError(404, "Post not found"));
  }

  await deletePostCascade(post);

  res.status(200).json({
    status: "success",
    message: "Post deleted by admin",
  });
});

const deleteUserAsAdmin = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ApiError(404, "User not found"));
  }

  if (user._id.toString() === req.user.id) {
    return next(new ApiError(400, "Admin cannot delete own account"));
  }

  const userPosts = await Post.find({ authorId: user._id });
  await Promise.all(userPosts.map((post) => deletePostCascade(post)));

  await Promise.all([
    User.deleteOne({ _id: user._id }),
    Follow.deleteMany({ $or: [{ followerId: user._id }, { followeeId: user._id }] }),
    Collection.deleteMany({ ownerId: user._id }),
    MediaAsset.deleteMany({ ownerId: user._id }),
    Post.updateMany(
      { "comments.userId": user._id },
      { $pull: { comments: { userId: user._id } } }
    ),
    Reaction.deleteMany({ userId: user._id }),
    Report.deleteMany({ $or: [{ reporterId: user._id }, { targetType: "user", targetId: user._id }] }),
  ]);

  res.status(200).json({
    status: "success",
    message: "User account and related data deleted by admin",
  });
});

// Issue a one-time password-reset token for a user who has lost both their
// password and their backup codes. The token is returned directly to the admin
// (over an authenticated channel) and the admin shares it with the user. Same
// underlying primitive as the regular forgot-password flow — just admin-issued.
const issueResetToken = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new ApiError(404, "User not found"));

  const rawToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetTokenHash = hashResetToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save({ validateBeforeSave: false });

  const baseUrl =
    req.headers.origin ||
    `${req.protocol}://${req.get("host").replace(/:\d+$/, ":3000")}`;

  res.status(200).json({
    status: "success",
    message: "Reset token issued. Share the link with the user — it expires in 30 minutes.",
    user: { id: user._id, email: user.email, username: user.username },
    resetToken: rawToken,
    expiresAt: user.passwordResetExpires,
    resetLink: `${baseUrl}/reset-password?token=${rawToken}`,
  });
});

const listReports = asyncHandler(async (req, res) => {
  const { status = "open" } = req.query;
  const query = status === "all" ? {} : { status };

  const reports = await Report.find(query)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("reporterId", "username")
    .populate("resolvedBy", "username");

  // Hydrate each report's target row with a snippet for the admin UI
  const Post = require("../models").Post;
  const hydrated = await Promise.all(
    reports.map(async (r) => {
      const obj = r.toObject();
      if (r.targetType === "user") {
        const u = await User.findById(r.targetId).select("username email avatarUrl isSuspended reportCount");
        obj.target = u;
      } else {
        const p = await Post.findById(r.targetId)
          .select("content authorId visibility reportCount")
          .populate("authorId", "username");
        obj.target = p;
      }
      return obj;
    })
  );

  res.status(200).json({
    status: "success",
    results: hydrated.length,
    reports: hydrated,
  });
});

const resolveReport = asyncHandler(async (req, res, next) => {
  const { action } = req.body; // 'resolved' | 'dismissed'
  if (!["resolved", "dismissed"].includes(action)) {
    return next(new ApiError(400, "action must be resolved or dismissed"));
  }

  const report = await Report.findById(req.params.id);
  if (!report) return next(new ApiError(404, "Report not found"));

  report.status = action;
  report.resolvedBy = req.user.id;
  report.resolvedAt = new Date();
  await report.save();

  res.status(200).json({ status: "success", report });
});

module.exports = {
  listUsers,
  listPosts,
  setUserRole,
  suspendUser,
  deletePostAsAdmin,
  deleteUserAsAdmin,
  issueResetToken,
  listReports,
  resolveReport,
};
