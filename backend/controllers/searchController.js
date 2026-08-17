const { SearchIndex, Post, User, Tag } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination } = require("../utils/pagination");
const { escapeRegex } = require("../utils/escapeRegex");

// @desc    Full-text search across posts
// @route   GET /api/search
// @access  Public (Mixed inside)
const search = asyncHandler(async (req, res, next) => {
  const { q, tag, user } = req.query;
  const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

  if (!q && !tag && !user) {
    return res.status(200).json({ status: "success", results: 0, posts: [], users: [], tags: [] });
  }

  const query = { visibility: "public" }; // Only search public posts

  if (q) {
    query.$text = { $search: q };
  }

  if (tag) {
    query.tagSlugs = tag.toLowerCase(); // Exact match on array
  }

  if (user) {
    // Anchored exact match on the author name; escaped so `?user=.*` cannot
    // turn into a wildcard that returns every public post.
    query.authorUsername = new RegExp(`^${escapeRegex(user)}$`, "i");
  }

  // Find in SearchIndex
  let searchQuery = SearchIndex.find(query).skip(skip).limit(limit);

  if (q) {
    // Sort by text score if querying by text
    searchQuery = searchQuery.sort({ score: { $meta: "textScore" } });
  } else {
    // Otherwise newest first
    searchQuery = searchQuery.sort({ createdAt: -1 });
  }

  const [indexHits, total] = await Promise.all([searchQuery, SearchIndex.countDocuments(query)]);

  const postIds = indexHits.map((hit) => hit.postId);

  const posts = postIds.length
    ? await Post.find({ _id: { $in: postIds } })
        .populate("authorId", "username avatarUrl")
        .populate("tagIds", "name slug")
    : [];

  const orderedPosts = postIds
    .map((id) => posts.find((p) => p._id.toString() === id.toString()))
    .filter(Boolean);

  const cleanedPosts = orderedPosts.map((post) => {
    const postObj = post.toObject();
    const isOwner = req.user && postObj.authorId && req.user.id === postObj.authorId._id.toString();

    if (postObj.isAnonymous && !isOwner) {
      postObj.authorId = null;
    }

    return postObj;
  });

  const userQuery = {};
  const userSearchTerm = user || q;
  if (userSearchTerm) {
    const escaped = escapeRegex(userSearchTerm);
    userQuery.$or = [
      { username: { $regex: escaped, $options: "i" } },
      { "profile.displayName": { $regex: escaped, $options: "i" } },
    ];
  }

  const users = userSearchTerm
    ? await User.find(userQuery).select("username avatarUrl bio profile.displayName").limit(10)
    : [];

  const tagSearchTerm = tag || q;
  const escapedTagTerm = escapeRegex(tagSearchTerm);
  const tags = tagSearchTerm
    ? await Tag.find({
        $or: [
          { slug: { $regex: escapedTagTerm, $options: "i" } },
          { name: { $regex: escapedTagTerm, $options: "i" } },
        ],
      })
        .sort({ usageCount: -1 })
        .limit(10)
    : [];

  res.status(200).json({
    status: "success",
    results: cleanedPosts.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    posts: cleanedPosts,
    users,
    tags,
  });
});

module.exports = {
  search,
};
