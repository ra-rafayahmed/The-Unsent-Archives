const { Tag, Post } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination } = require("../utils/pagination");

// @desc    List tags, optionally filtered by category
// @route   GET /api/tags
// @access  Public
const listTags = asyncHandler(async (req, res, next) => {
  const { category } = req.query;
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit, 50);

  const query = {};
  if (category) {
    query.category = category;
  }

  const [tags, total] = await Promise.all([
    Tag.find(query).sort({ name: 1 }).skip(skip).limit(limit),
    Tag.countDocuments(query),
  ]);

  res.status(200).json({
    status: "success",
    results: tags.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    tags,
  });
});

// @desc    Get trending tags by usage count
// @route   GET /api/tags/trending
// @access  Public
const getTrending = asyncHandler(async (req, res, next) => {
  const tags = await Tag.find()
    .sort({ usageCount: -1 })
    .limit(20);

  res.status(200).json({
    status: "success",
    tags,
  });
});

// @desc    Get posts by tag slug
// @route   GET /api/tags/:slug/posts
// @access  Public (Mixed inside)
const getPostsByTag = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

  // Only public posts
  const query = { tagSlugs: slug, visibility: "public" };

  const [posts, total] = await Promise.all([
    Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("authorId", "username avatarUrl"),
    Post.countDocuments(query)
  ]);

  // Strip anonymous
  const cleanedPosts = posts.map(post => {
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

module.exports = {
  listTags,
  getTrending,
  getPostsByTag,
};
