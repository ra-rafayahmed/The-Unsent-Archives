const { Follow, User } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { getPagination } = require("../utils/pagination");

const requireFolloweeId = (req, next) => {
  const followeeId = req.params.id || (req.body && req.body.followeeId);
  if (!followeeId) {
    next(new ApiError(400, "followeeId is required"));
    return null;
  }
  return followeeId;
};

// @desc    Follow a user
// @route   POST /api/users/:id/follow
// @access  Private
const followUser = asyncHandler(async (req, res, next) => {
  const followeeId = requireFolloweeId(req, next);
  if (!followeeId) return;
  const followerId = req.user.id;

  if (followeeId === followerId) {
    return next(new ApiError(400, "You cannot follow yourself"));
  }

  const followee = await User.findById(followeeId);
  if (!followee) {
    return next(new ApiError(404, "User not found"));
  }

  try {
    await Follow.create({ followerId, followeeId });
    res.status(201).json({
      status: "success",
      message: `You are now following user ${followeeId}`,
    });
  } catch (error) {
    // 11000 is MongoDB's duplicate key error code
    if (error.code === 11000) {
      return next(new ApiError(409, "You are already following this user"));
    }
    next(error);
  }
});

// @desc    Unfollow a user
// @route   DELETE /api/users/:id/follow
// @access  Private
const unfollowUser = asyncHandler(async (req, res, next) => {
  const followeeId = requireFolloweeId(req, next);
  if (!followeeId) return;
  const followerId = req.user.id;

  const result = await Follow.deleteOne({ followerId, followeeId });

  if (result.deletedCount === 0) {
    return res.status(400).json({
      status: "fail",
      message: "You are not following this user",
    });
  }

  res.status(200).json({
    status: "success",
    message: `You have unfollowed user ${followeeId}`,
  });
});

// @desc    Get user's followers
// @route   GET /api/users/:id/followers
// @access  Public
const getFollowers = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

  const [follows, total] = await Promise.all([
    Follow.find({ followeeId: id })
      .sort({ followedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate("followerId", "username avatarUrl profile.displayName"),
    Follow.countDocuments({ followeeId: id }),
  ]);

  res.status(200).json({
    status: "success",
    results: follows.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    followers: follows.map((f) => ({
      ...f.followerId.toObject(),
      followedAt: f.followedAt,
    })),
  });
});

// @desc    Get users that a user follows
// @route   GET /api/users/:id/following
// @access  Public
const getFollowing = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

  const [follows, total] = await Promise.all([
    Follow.find({ followerId: id })
      .sort({ followedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate("followeeId", "username avatarUrl profile.displayName"),
    Follow.countDocuments({ followerId: id }),
  ]);

  res.status(200).json({
    status: "success",
    results: follows.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    following: follows.map((f) => ({
      ...f.followeeId.toObject(),
      followedAt: f.followedAt,
    })),
  });
});

// @desc    Get follow status between current user and profile user
// @route   GET /api/users/:id/follow/status
// @access  Private
const getFollowStatus = asyncHandler(async (req, res, next) => {
  const followeeId = req.params.id;
  const followerId = req.user.id;

  const isFollowing = Boolean(
    await Follow.exists({
      followerId,
      followeeId,
    })
  );

  res.status(200).json({
    status: "success",
    isFollowing,
  });
});

module.exports = {
  // Existing nested routes
  followUser,
  unfollowUser,
  getFollowStatus,
  getFollowers,
  getFollowing,
  // Frontend-compatible global routes
  followUserGlobal: followUser,
  unfollowUserGlobal: unfollowUser,
  getFollowersGlobal: asyncHandler(async (req, res, next) => {
    req.params.id = req.query.userId || req.user.id;
    return getFollowers(req, res, next);
  }),
  getFollowingGlobal: asyncHandler(async (req, res, next) => {
    req.params.id = req.query.userId || req.user.id;
    return getFollowing(req, res, next);
  }),
};
