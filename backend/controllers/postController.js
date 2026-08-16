const { Post, Tag, SearchIndex, Collection, Reaction, AnalyticsEvent } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const RecommendationService = require("../services/recommendationService");
const logger = require("../utils/logger");

const normalizePostInput = (body) => {
  const normalizedVisibility = body.visibility === "anonymous" ? "public" : body.visibility;
  const normalizedAnonymous =
    body.visibility === "anonymous" ? true : Boolean(body.isAnonymous);
  const normalizedTags =
    Array.isArray(body.tagSlugs) && body.tagSlugs.length > 0
      ? body.tagSlugs
      : Array.isArray(body.tags)
        ? body.tags
        : [];

  return {
    visibility: normalizedVisibility,
    isAnonymous: normalizedAnonymous,
    tags: normalizedTags,
  };
};

// Helper to process tags: creates missing tags, increments counts, returns ObjectIds and Slugs
const processTags = async (tagNames) => {
  if (!tagNames || tagNames.length === 0) return { tagIds: [], tagSlugs: [] };
  
  // Clean names to lower, hyphenated slugs
  const slugs = tagNames.map(name => name.toLowerCase().trim().replace(/\s+/g, '-'));
  
  const tagIds = [];
  
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const name = tagNames[i].trim();
    
    // Find or create tag
    let tag = await Tag.findOne({ slug });
    
    if (tag) {
      tag.usageCount += 1;
      await tag.save();
    } else {
      tag = await Tag.create({ name, slug, usageCount: 1 });
    }
    
    tagIds.push(tag._id);
  }
  
  return { tagIds, tagSlugs: slugs };
};

// @desc    Create a post
// @route   POST /api/posts
// @access  Private
const createPost = asyncHandler(async (req, res, next) => {
  const { content, style, media } = req.body;
  const { visibility, isAnonymous, tags } = normalizePostInput(req.body);

  const { tagIds, tagSlugs } = await processTags(tags);

  const post = await Post.create({
    authorId: req.user.id,
    content,
    visibility,
    isAnonymous,
    style,
    media,
    tagIds,
    tagSlugs,
  });

  // SearchIndex is upserted automatically by Post.post("save") trigger
  // (see models/Post.js). We just patch the authorUsername here, which the
  // trigger doesn't know about.
  await SearchIndex.updateOne(
    { postId: post._id },
    { $set: { authorUsername: req.user.username } }
  );

  res.status(201).json({
    status: "success",
    post,
  });
});

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Mixed (Depends on visibility)
const getPost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id)
    .populate("authorId", "username avatarUrl")
    .populate("tagIds", "name slug category")
    .populate("repostOf")
    .populate("comments.userId", "username avatarUrl");

  if (!post) {
    return next(new ApiError(404, "Post not found"));
  }

  // Permissions check
  const isOwner = req.user && req.user.id === post.authorId._id.toString();
  
  if (post.visibility === "private" && !isOwner) {
    return next(new ApiError(403, "This post is private"));
  }
  
  // TODO: Add logic for 'followers' visibility if needed

  const postObj = post.toObject();

  // Handle anonymity
  if (postObj.isAnonymous && !isOwner) {
    postObj.authorId = null;
  }

  // Mask anonymous commenters from anyone who isn't the comment's own author.
  // The post author can still see who wrote what so they can moderate.
  postObj.comments = (postObj.comments || []).map((c) => {
    if (!c.isAnonymous) return c;
    const isCommentOwner = req.user && c.userId && req.user.id === (c.userId._id || c.userId).toString();
    if (isCommentOwner || isOwner) return c;
    return { ...c, userId: null };
  });

  // Fire-and-forget Analytics Log for viewing
  // (In production, you'd want to queue this or only log unique views per session)
  AnalyticsEvent.create({
    postId: post._id,
    actorId: req.user ? req.user.id : null,
    eventType: "view",
    ipHash: req.ip, // Hashing IP is better for privacy
  }).catch((err) =>
    logger.warn({ err, postId: post._id, userId: req.user?.id }, "failed to log view analytics event")
  );
  
  // Atomically increment views
  Post.findByIdAndUpdate(post._id, { $inc: { viewCount: 1 } }).exec();

  // Feed the recommender (only when an authenticated user views)
  if (req.user?.id && req.user.id !== post.authorId._id.toString()) {
    RecommendationService.logEngagement(req.user.id, post._id, "view");
  }

  res.status(200).json({
    status: "success",
    post: postObj,
  });
});

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private (Author only)
const updatePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new ApiError(404, "Post not found"));
  }

  if (post.authorId.toString() !== req.user.id) {
    return next(new ApiError(403, "You can only edit your own posts"));
  }

  // Update fields
  const allowedUpdates = ["content", "visibility", "isAnonymous", "style", "media"];
  const normalizedInput = normalizePostInput(req.body);

  if (req.body.visibility !== undefined) {
    post.visibility = normalizedInput.visibility;
  }

  if (req.body.isAnonymous !== undefined || req.body.visibility === "anonymous") {
    post.isAnonymous = normalizedInput.isAnonymous;
  }

  allowedUpdates.forEach(field => {
    if (field === "visibility" || field === "isAnonymous") return;
    if (req.body[field] !== undefined) {
      post[field] = req.body[field];
    }
  });

  // Handle tags update (complex: requires diffing and adjusting Tag usageCounts)
  if (req.body.tags !== undefined || req.body.tagSlugs !== undefined) {
     // Extremely simplified for this scale: we don't decrement old tags here to save time,
     // but in a production environment, you should $inc usageCount -1 for removed tags.
     const { tagIds, tagSlugs } = await processTags(normalizedInput.tags);
     post.tagIds = tagIds;
     post.tagSlugs = tagSlugs;
  }

  await post.save();
  // SearchIndex stays in sync via Post.post("save") trigger.

  res.status(200).json({
    status: "success",
    post,
  });
});

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private (Author only)
const deletePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new ApiError(404, "Post not found"));
  }

  if (post.authorId.toString() !== req.user.id) {
    return next(new ApiError(403, "You can only delete your own posts"));
  }

  // Cascade Deletes & Cleanups in parallel
  const cascadeOps = [
    post.deleteOne(),
    Reaction.deleteMany({ postId: post._id }),
    AnalyticsEvent.deleteMany({ postId: post._id }),
    SearchIndex.deleteOne({ postId: post._id }),
    Collection.updateMany(
      { postIds: post._id },
      { $pull: { postIds: post._id }, $inc: { postCount: -1 } }
    ),
    // Decrement tag usage counts
    Tag.updateMany(
      { _id: { $in: post.tagIds } },
      { $inc: { usageCount: -1 } }
    )
  ];

  await Promise.all(cascadeOps);

  res.status(200).json({
    status: "success",
    message: "Post deleted successfully",
  });
});

// @desc    Repost
// @route   POST /api/posts/:id/repost
// @access  Private
const repost = asyncHandler(async (req, res, next) => {
  const originalPost = await Post.findById(req.params.id);
  
  if (!originalPost) {
    return next(new ApiError(404, "Original post not found"));
  }

  // Verify can view original
  if (originalPost.visibility === "private" && originalPost.authorId.toString() !== req.user.id) {
    return next(new ApiError(403, "Cannot repost private content"));
  }

  const { content = "", visibility = "public", isAnonymous = false } = req.body;

  const post = await Post.create({
    authorId: req.user.id,
    content: content || `Repost of ${originalPost._id}`, 
    visibility,
    isAnonymous,
    repostOf: originalPost._id,
  });

  AnalyticsEvent.create({
    postId: originalPost._id,
    actorId: req.user.id,
    eventType: "share",
  }).catch((err) =>
    logger.warn({ err, postId: originalPost._id, userId: req.user.id }, "failed to log share analytics event")
  );

  res.status(201).json({
    status: "success",
    post,
  });
});

// @desc    Add comment to a post
// @route   POST /api/posts/:id/comments
// @access  Private
const addComment = asyncHandler(async (req, res, next) => {
  const { text, isAnonymous } = req.body;

  if (!text) return next(new ApiError(400, "Comment text is required"));

  const post = await Post.findById(req.params.id);
  if (!post) return next(new ApiError(404, "Post not found"));

  if (post.comments.length >= 500) {
    return next(new ApiError(400, "Maximum comment limit reached for this post"));
  }

  post.comments.push({
    userId: req.user.id,
    text,
    isAnonymous: Boolean(isAnonymous),
  });

  await post.save();

  // Feed the recommender
  RecommendationService.logEngagement(req.user.id, post._id, "comment");

  // Re-fetch with populated comment authors so the client can render the new
  // comment without a second request.
  const populated = await Post.findById(post._id)
    .populate("authorId", "username avatarUrl")
    .populate("comments.userId", "username avatarUrl");

  res.status(200).json({
    status: "success",
    post: populated,
  });
});

// @desc    Delete a comment
// @route   DELETE /api/posts/:id/comments/:commentId
// @access  Private
const deleteComment = asyncHandler(async (req, res, next) => {
  const { id, commentId } = req.params;

  const post = await Post.findById(id);
  if (!post) return next(new ApiError(404, "Post not found"));

  const comment = post.comments.id(commentId);
  if (!comment) return next(new ApiError(404, "Comment not found"));

  // Only comment author OR post author can delete it
  if (comment.userId.toString() !== req.user.id && post.authorId.toString() !== req.user.id) {
    return next(new ApiError(403, "Not authorized to delete this comment"));
  }

  comment.deleteOne();
  await post.save();

  res.status(200).json({
    status: "success",
    message: "Comment deleted",
  });
});

module.exports = {
  createPost,
  getPost,
  updatePost,
  deletePost,
  repost,
  addComment,
  deleteComment
};
