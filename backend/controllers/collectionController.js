const { Collection, Post, AnalyticsEvent } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const RecommendationService = require("../services/recommendationService");
const logger = require("../utils/logger");

// @desc    Create a collection
// @route   POST /api/collections
// @access  Private
const createCollection = asyncHandler(async (req, res, next) => {
  const { name, description, visibility } = req.body;

  const collection = await Collection.create({
    ownerId: req.user.id,
    name,
    description,
    visibility,
  });

  res.status(201).json({
    status: "success",
    collection,
  });
});

// @desc    Get collection details + posts
// @route   GET /api/collections/:id
// @access  Mixed (Depends on visibility and ownership)
const getCollection = asyncHandler(async (req, res, next) => {
  const collection = await Collection.findById(req.params.id)
    .populate("ownerId", "username avatarUrl profile.displayName")
    .populate({
      path: "postIds",
      populate: [
        { path: "authorId", select: "username avatarUrl" },
        { path: "tagIds", select: "name slug" },
      ],
    });

  if (!collection) {
    return next(new ApiError(404, "Collection not found"));
  }

  const isOwner = req.user && req.user.id === collection.ownerId._id.toString();

  if (collection.visibility === "private" && !isOwner) {
    return next(new ApiError(403, "This collection is private"));
  }

  // Handle anonymous posts inside the collection for non-owners
  const colObj = collection.toObject();
  colObj.postIds = colObj.postIds.map((post) => {
    if (post.isAnonymous && (!req.user || req.user.id !== post.authorId._id.toString())) {
      post.authorId = null;
    }
    return post;
  });

  res.status(200).json({
    status: "success",
    collection: colObj,
  });
});

// @desc    Update collection metadata
// @route   PUT /api/collections/:id
// @access  Private (Owner only)
const updateCollection = asyncHandler(async (req, res, next) => {
  const collection = await Collection.findById(req.params.id);

  if (!collection) {
    return next(new ApiError(404, "Collection not found"));
  }

  if (collection.ownerId.toString() !== req.user.id) {
    return next(new ApiError(403, "You can only update your own collections"));
  }

  const { name, description, visibility } = req.body;
  if (name) collection.name = name;
  if (description !== undefined) collection.description = description;
  if (visibility) collection.visibility = visibility;

  await collection.save();

  res.status(200).json({
    status: "success",
    collection,
  });
});

// @desc    Delete collection
// @route   DELETE /api/collections/:id
// @access  Private (Owner only)
const deleteCollection = asyncHandler(async (req, res, next) => {
  const collection = await Collection.findById(req.params.id);

  if (!collection) {
    return next(new ApiError(404, "Collection not found"));
  }

  if (collection.ownerId.toString() !== req.user.id) {
    return next(new ApiError(403, "You can only delete your own collections"));
  }

  await collection.deleteOne();

  // Note: We don't decrement Post.saveCount here because saveCount represents
  // historical saves across all time/collections.

  res.status(200).json({
    status: "success",
    message: "Collection deleted successfully",
  });
});

// @desc    Add post to collection
// @route   POST /api/collections/:id/posts
// @access  Private (Owner only)
const addPost = asyncHandler(async (req, res, next) => {
  const { postId } = req.body;

  if (!postId) return next(new ApiError(400, "postId is required"));

  const collection = await Collection.findById(req.params.id);
  if (!collection) return next(new ApiError(404, "Collection not found"));

  if (collection.ownerId.toString() !== req.user.id) {
    return next(new ApiError(403, "Not authorized to modify this collection"));
  }

  if (collection.postIds.includes(postId)) {
    return next(new ApiError(400, "Post already in collection"));
  }

  const post = await Post.findById(postId);
  if (!post) return next(new ApiError(404, "Post not found"));

  // Check if post is accessible to user (private post from someone else is not allowed)
  if (post.visibility === "private" && post.authorId.toString() !== req.user.id) {
    return next(new ApiError(403, "Cannot save private posts from other users"));
  }

  // Add securely using mongoose push
  collection.postIds.push(postId);
  collection.postCount += 1;
  await collection.save();

  // Atomically increment post saveCount
  await Post.findByIdAndUpdate(postId, { $inc: { saveCount: 1 } });

  // Log analytics event
  AnalyticsEvent.create({
    postId: postId,
    actorId: req.user.id,
    eventType: "save",
  }).catch((err) =>
    logger.warn({ err, postId, userId: req.user.id }, "failed to log save analytics event")
  );

  // Feed the recommender
  RecommendationService.logEngagement(req.user.id, postId, "save");

  res.status(200).json({
    status: "success",
    message: "Post added to collection",
  });
});

// @desc    Remove post from collection
// @route   DELETE /api/collections/:id/posts/:postId
// @access  Private (Owner only)
const removePost = asyncHandler(async (req, res, next) => {
  const collection = await Collection.findById(req.params.id);
  if (!collection) return next(new ApiError(404, "Collection not found"));

  if (collection.ownerId.toString() !== req.user.id) {
    return next(new ApiError(403, "Not authorized to modify this collection"));
  }

  const { postId } = req.params;

  if (!collection.postIds.includes(postId)) {
    return next(new ApiError(400, "Post not in collection"));
  }

  collection.postIds.pull(postId);
  collection.postCount -= 1;
  await collection.save();

  await Post.findByIdAndUpdate(postId, { $inc: { saveCount: -1 } });

  res.status(200).json({
    status: "success",
    message: "Post removed from collection",
  });
});

module.exports = {
  createCollection,
  getCollection,
  updateCollection,
  deleteCollection,
  addPost,
  removePost,
};
