const { AnalyticsEvent, Post } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const mongoose = require("mongoose");

const canonicalEventType = (value = "") => {
  const key = String(value || "").trim().toLowerCase();

  if (key === "view" || key === "views") return "view";
  if (key === "save" || key === "saved" || key === "bookmark") return "save";
  if (key === "reaction" || key === "react") return "reaction";

  return key;
};

const toCanonicalSummary = (events = []) => {
  return events.reduce((acc, curr) => {
    const eventKey = canonicalEventType(curr._id);
    if (!eventKey) return acc;

    acc[eventKey] = (acc[eventKey] || 0) + curr.count;
    return acc;
  }, {});
};

// @desc    Log an analytics event
// @route   POST /api/analytics/events
// @access  Mixed (optional auth)
const logEvent = asyncHandler(async (req, res, next) => {
  const { postId, eventType, type, metadata } = req.body;
  const normalizedEventType = eventType || type;

  if (!postId || !normalizedEventType) {
    return next(new ApiError(400, "postId and eventType/type are required"));
  }

  // Let other controllers handle 'view' and 'save' and 'share' directly when those actions happen.
  // This endpoint is mostly useful for client-side explicit 'click' on external links, or 'report'
  
  await AnalyticsEvent.create({
    postId,
    actorId: req.user ? req.user.id : null,
    eventType: normalizedEventType,
    ipHash: process.env.NODE_ENV === "production" ? req.ip : "localhost", 
    metadata
  });

  res.status(201).json({ status: "success", eventType: normalizedEventType });
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
    { $match: { postId: new mongoose.Types.ObjectId(postId) } },
    { $group: { _id: "$eventType", count: { $sum: 1 } } }
  ]);

  const summary = toCanonicalSummary(events);

  const commentsCount = post.comments?.length || 0;
  const reads = Math.max(post.viewCount || 0, summary.view || 0);
  const engagementTotal = (post.reactionCount || 0) + (post.saveCount || 0) + commentsCount;
  const engagementRate = reads > 0 ? Number(((engagementTotal / reads) * 100).toFixed(2)) : 0;

  // Combine with denormalized counters
  res.status(200).json({
    status: "success",
    analytics: {
      views: post.viewCount,
      saves: post.saveCount,
      reactions: post.reactionCount,
      comments: commentsCount,
      engagementRate,
      events: summary,
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
      { $match: { authorId: new mongoose.Types.ObjectId(req.user.id) } },
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

  const summary = toCanonicalSummary(events);

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
