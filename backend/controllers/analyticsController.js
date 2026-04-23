const { AnalyticsEvent, Post } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

// @desc    Log an analytics event
// @route   POST /api/analytics/events
// @access  Mixed (optional auth)
const logEvent = asyncHandler(async (req, res, next) => {
  const { postId, eventType, metadata } = req.body;

  if (!postId || !eventType) {
    return next(new ApiError(400, "postId and eventType are required"));
  }

  // Let other controllers handle 'view' and 'save' and 'share' directly when those actions happen.
  // This endpoint is mostly useful for client-side explicit 'click' on external links, or 'report'
  
  await AnalyticsEvent.create({
    postId,
    actorId: req.user ? req.user.id : null,
    eventType,
    ipHash: process.env.NODE_ENV === "production" ? req.ip : "localhost", 
    metadata
  });

  res.status(201).json({ status: "success" });
});

// @desc    Get analytics for a specific post
// @route   GET /api/posts/:id/analytics
// @access  Private (Author only)
const getPostAnalytics = asyncHandler(async (req, res, next) => {
  const postId = req.params.id;

  const post = await Post.findById(postId);
  if (!post) return next(new ApiError(404, "Post not found"));

  if (post.authorId.toString() !== req.user.id) {
    return next(new ApiError(403, "Not authorized to view these analytics"));
  }

  const events = await AnalyticsEvent.aggregate([
    { $match: { postId: require('mongoose').Types.ObjectId(postId) } },
    { $group: { _id: "$eventType", count: { $sum: 1 } } }
  ]);

  const summary = events.reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});

  // Combine with denormalized counters
  res.status(200).json({
    status: "success",
    analytics: {
      views: post.viewCount,
      saves: post.saveCount,
      reactions: post.reactionCount,
      ...summary
    }
  });
});

// @desc    Get aggregate analytics for all user's posts
// @route   GET /api/users/:id/analytics
// @access  Private (Owner only)
const getUserAnalytics = asyncHandler(async (req, res, next) => {
  if (req.user.id !== req.params.id) {
    return next(new ApiError(403, "Not authorized to view these analytics"));
  }

  const posts = await Post.find({ authorId: req.user.id });
  const postIds = posts.map(p => p._id);

  const [totals, events] = await Promise.all([
    // Aggregate denormalized counters
    Post.aggregate([
      { $match: { authorId: require('mongoose').Types.ObjectId(req.user.id) } },
      { $group: { 
          _id: null, 
          totalViews: { $sum: "$viewCount" },
          totalSaves: { $sum: "$saveCount" },
          totalReactions: { $sum: "$reactionCount" }
        }
      }
    ]),
    // Aggregate detailed events
    AnalyticsEvent.aggregate([
      { $match: { postId: { $in: postIds } } },
      { $group: { _id: "$eventType", count: { $sum: 1 } } }
    ])
  ]);

  const summary = events.reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});

  const denormalizedTotals = totals.length > 0 ? totals[0] : { totalViews: 0, totalSaves: 0, totalReactions: 0 };
  delete denormalizedTotals._id;

  res.status(200).json({
    status: "success",
    totals: denormalizedTotals,
    eventBreakdown: summary
  });
});

module.exports = {
  logEvent,
  getPostAnalytics,
  getUserAnalytics
};
