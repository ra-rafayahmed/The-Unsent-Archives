const { Post, Follow } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination } = require("../utils/pagination");

// @desc    Get explore feed (global public posts)
// @route   GET /api/feed
// @access  Public (Mixed to strip anonymous)
const getExplore = asyncHandler(async (req, res, next) => {
  const { sort = "recent" } = req.query; // 'recent' or 'popular'
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

  const query = { visibility: "public" };
  const sortCriteria =
    sort === "popular" ? { reactionCount: -1, viewCount: -1, createdAt: -1 } : { createdAt: -1 };

  const [posts, total] = await Promise.all([
    Post.find(query)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit)
      .populate("authorId", "username avatarUrl")
      .populate("tagIds", "name slug"),
    Post.countDocuments(query),
  ]);

  const cleanedPosts = posts.map((post) => {
    const p = post.toObject();
    if (p.isAnonymous && (!req.user || req.user.id !== p.authorId._id.toString())) {
      p.authorId = null;
    }
    return p;
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

// @desc    Get personalized feed from followed users
// @route   GET /api/feed/following
// @access  Private
const getFollowingFeed = asyncHandler(async (req, res, next) => {
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

  // Find all users the current user follows
  const follows = await Follow.find({ followerId: req.user.id });
  const followeeIds = follows.map((f) => f.followeeId);

  // Also include user's own posts
  followeeIds.push(req.user.id);

  // Fetch posts by these users (public or followers-only visibility)
  const query = {
    authorId: { $in: followeeIds },
    visibility: { $in: ["public", "followers"] }, // "private" excluded
  };

  const [posts, total] = await Promise.all([
    Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("authorId", "username avatarUrl")
      .populate("tagIds", "name slug"),
    Post.countDocuments(query),
  ]);

  const cleanedPosts = posts.map((post) => {
    const p = post.toObject();
    if (p.isAnonymous && req.user.id !== p.authorId._id.toString()) {
      p.authorId = null;
    }
    return p;
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

// @desc    Get top trending posts last 7 days
// @route   GET /api/feed/trending
// @access  Public
const getTrending = asyncHandler(async (req, res, next) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const posts = await Post.find({
    visibility: "public",
    createdAt: { $gte: sevenDaysAgo },
  })
    .sort({ reactionCount: -1, saveCount: -1 }) // Simple sort, or could use aggregation for complex scoring
    .limit(20)
    .populate("authorId", "username avatarUrl")
    .populate("tagIds", "name slug");

  const cleanedPosts = posts.map((post) => {
    const p = post.toObject();
    if (p.isAnonymous && (!req.user || req.user.id !== p.authorId._id.toString())) {
      p.authorId = null;
    }
    return p;
  });

  res.status(200).json({
    status: "success",
    posts: cleanedPosts,
  });
});

module.exports = {
  getExplore,
  getFollowingFeed,
  getTrending,
};
