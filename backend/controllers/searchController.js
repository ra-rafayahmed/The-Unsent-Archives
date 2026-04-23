const { SearchIndex, Post } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination } = require("../utils/pagination");

// @desc    Full-text search across posts
// @route   GET /api/search
// @access  Public (Mixed inside)
const search = asyncHandler(async (req, res, next) => {
  const { q, tag, user } = req.query;
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

  if (!q && !tag && !user) {
    return res.status(200).json({ status: "success", results: 0, posts: [] });
  }

  const query = { visibility: "public" }; // Only search public posts

  if (q) {
    query.$text = { $search: q };
  }
  
  if (tag) {
    query.tagSlugs = tag.toLowerCase(); // Exact match on array
  }

  if (user) {
    query.authorUsername = new RegExp(`^${user}$`, "i");
  }

  // Find in SearchIndex
  let searchQuery = SearchIndex.find(query)
    .skip(skip)
    .limit(limit);

  if (q) {
    // Sort by text score if querying by text
    searchQuery = searchQuery.sort({ score: { $meta: "textScore" } });
  } else {
    // Otherwise newest first
    searchQuery = searchQuery.sort({ createdAt: -1 });
  }

  const [indexHits, total] = await Promise.all([
    searchQuery,
    SearchIndex.countDocuments(query)
  ]);

  // If no hits, return empty
  if (indexHits.length === 0) {
    return res.status(200).json({ status: "success", results: 0, total: 0, page, posts: [] });
  }

  // Extract post IDs
  const postIds = indexHits.map(hit => hit.postId);

  // Fetch full posts
  const posts = await Post.find({ _id: { $in: postIds } })
    .populate("authorId", "username avatarUrl")
    .populate("tagIds", "name slug");

  // Re-sort posts according to the indexHits order (since $in doesn't preserve order)
  const orderedPosts = postIds.map(id => posts.find(p => p._id.toString() === id.toString())).filter(Boolean);

  res.status(200).json({
    status: "success",
    results: orderedPosts.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    posts: orderedPosts
  });
});

module.exports = {
  search
};
