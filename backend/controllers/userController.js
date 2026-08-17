const { User, Post, Collection, Follow } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { getPagination } = require("../utils/pagination");

// @desc    Get user profile by ID
// @route   GET /api/users/:id
// @access  Public
// Allowlist rather than denylist: anything added to the User schema later stays
// private until it is deliberately published here. The previous denylist only
// stripped email/isActive and leaked role, reportCount and isSuspended.
const PUBLIC_PROFILE_FIELDS = "username avatarUrl bio profile tagInterests createdAt";

const getProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select(PUBLIC_PROFILE_FIELDS)
    .populate("tagInterests", "name slug")
    .lean(); // Faster query, returns plain JS object

  if (!user) {
    return next(new ApiError(404, "User not found"));
  }

  // Aggregate follower and following counts
  const [followerCount, followingCount] = await Promise.all([
    Follow.countDocuments({ followeeId: user._id }),
    Follow.countDocuments({ followerId: user._id }),
  ]);

  res.status(200).json({
    status: "success",
    user: {
      ...user,
      followerCount,
      followingCount,
    },
  });
});

// @desc    Update user profile
// @route   PUT /api/users/:id
// @access  Private (Owner only)
const updateProfile = asyncHandler(async (req, res, next) => {
  if (req.user.id !== req.params.id) {
    return next(new ApiError(403, "You can only update your own profile"));
  }

  // Allowed fields for update
  const { bio, avatarUrl, profile, tagInterests } = req.body;

  const updateData = {};
  if (bio !== undefined) updateData.bio = bio;
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
  if (profile !== undefined) updateData.profile = profile;
  if (tagInterests !== undefined) updateData.tagInterests = tagInterests;

  const user = await User.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  }).populate("tagInterests", "name slug");

  if (!user) {
    return next(new ApiError(404, "User not found"));
  }

  res.status(200).json({
    status: "success",
    user,
  });
});

// @desc    Get user's posts
// @route   GET /api/users/:id/posts
// @access  Public (Mixed based on auth)
const getUserPosts = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

  // Determine which posts a user can see
  const query = { authorId: id };

  // If the requester is NOT the author, they can only see public posts, or anonymous posts
  if (!req.user || req.user.id !== id) {
    query.visibility = "public"; // Optionally include 'followers' if checking follow status later
  }

  const [posts, total] = await Promise.all([
    Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("authorId", "username avatarUrl")
      .populate("tagIds", "name slug category"),
    Post.countDocuments(query),
  ]);

  // Strip author for anonymous posts if viewed by a non-author
  const cleanedPosts = posts.map((post) => {
    const postObj = post.toObject();
    if (postObj.isAnonymous && (!req.user || req.user.id !== postObj.authorId._id.toString())) {
      postObj.authorId = null;
    }
    return postObj;
  });

  res.status(200).json({
    status: "success",
    results: cleanedPosts.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    posts: cleanedPosts,
  });
});

// @desc    Get user's collections
// @route   GET /api/users/:id/collections
// @access  Public (Mixed based on auth)
const getUserCollections = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

  const query = { ownerId: id };

  if (!req.user || req.user.id !== id) {
    query.visibility = "public";
  }

  const [collections, total] = await Promise.all([
    Collection.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "postIds",
        select: "content style _id",
        options: { limit: 4 }, // Get only top 4 for a preview grid
      }),
    Collection.countDocuments(query),
  ]);

  res.status(200).json({
    status: "success",
    results: collections.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    collections,
  });
});

module.exports = {
  PUBLIC_PROFILE_FIELDS,
  getProfile,
  updateProfile,
  getUserPosts,
  getUserCollections,
};
