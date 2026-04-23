const { Reaction, Post } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

// @desc    React to a post
// @route   POST /api/posts/:id/reactions
// @access  Private
const addReaction = asyncHandler(async (req, res, next) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { type } = req.body;

  if (!["like", "love", "haha", "wow", "sad", "angry"].includes(type)) {
    return next(new ApiError(400, "Invalid reaction type"));
  }

  const post = await Post.findById(postId);
  if (!post) {
    return next(new ApiError(404, "Post not found"));
  }

  try {
    const newReaction = await Reaction.create({ postId, userId, type });
    
    // Atomically increment post reaction count
    await Post.findByIdAndUpdate(postId, { $inc: { reactionCount: 1 } });
    
    res.status(201).json({
      status: "success",
      reaction: newReaction,
    });
  } catch (error) {
    if (error.code === 11000) {
      // User already reacted with THIS type, or we could change the model to allow only 1 reaction per user totally.
      // With current schema { postId: 1, userId: 1, type: 1 } unique, they can 'like' and 'love'.
      // If we want 1 reaction max per user per post, we should change schema index to { postId: 1, userId: 1 }.
      // Let's assume current schema allows multiple types or we handle conflict.
      return next(new ApiError(409, "You have already cast this reaction"));
    }
    next(error);
  }
});

// @desc    Remove a reaction
// @route   DELETE /api/posts/:id/reactions
// @access  Private
const removeReaction = asyncHandler(async (req, res, next) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { type } = req.body; // or could just remove ALL reactions from user if we changed schema
  
  const query = { postId, userId };
  if (type) query.type = type;

  const result = await Reaction.deleteOne(query);

  if (result.deletedCount === 0) {
    return res.status(400).json({
      status: "fail",
      message: "Reaction not found",
    });
  }

  // Decrement post reaction count
  await Post.findByIdAndUpdate(postId, { $inc: { reactionCount: -1 } });

  res.status(200).json({
    status: "success",
    message: "Reaction removed",
  });
});

// @desc    Get reaction summary for a post
// @route   GET /api/posts/:id/reactions
// @access  Public
const getReactions = asyncHandler(async (req, res, next) => {
  const postId = req.params.id;

  const summary = await Reaction.aggregate([
    { $match: { postId: require('mongoose').Types.ObjectId(postId) } },
    { $group: { _id: "$type", count: { $sum: 1 } } }
  ]);

  // Format to { like: 5, love: 2 }
  const formattedSummary = summary.reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});

  res.status(200).json({
    status: "success",
    reactions: formattedSummary,
  });
});

module.exports = {
  addReaction,
  removeReaction,
  getReactions,
};
