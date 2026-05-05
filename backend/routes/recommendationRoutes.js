// routes/recommendationRoutes.js
// GET  /api/recommendations          – Personalised recommendations for the logged-in user
// POST /api/recommendations/refresh  – Manually trigger recommendation refresh

const express = require("express");
const router = express.Router();
const { Post, Recommendation } = require("../models");
const RecommendationService = require("../services/recommendationService");
const { auth } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

// @desc    Get personalised recommendations
// @route   GET /api/recommendations
// @access  Private
router.get(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const recs = await RecommendationService.getRecommendations(req.user.id, limit);

    // Populate full post data for each recommendation
    const populated = await Promise.all(
      recs.map(async (rec) => {
        const post = await Post.findById(rec.postId)
          .populate("authorId", "username avatarUrl")
          .populate("tagIds", "name slug")
          .lean();

        if (!post) return null;

        // Honour anonymous flag
        if (post.isAnonymous) {
          post.authorId = null;
        }

        return { ...rec, post };
      })
    );

    const data = populated.filter(Boolean);

    res.status(200).json({
      success: true,
      count:   data.length,
      data,
    });
  })
);

// @desc    Refresh recommendation cache for the logged-in user
// @route   POST /api/recommendations/refresh
// @access  Private
router.post(
  "/refresh",
  auth,
  asyncHandler(async (req, res) => {
    const recs = await RecommendationService.getRecommendations(req.user.id, 50);

    // Persist the refreshed recommendations to the Recommendation collection
    await Recommendation.findOneAndUpdate(
      { userId: req.user.id },
      {
        userId:           req.user.id,
        recommendedPosts: recs.map((r) => ({
          postId: r.postId,
          score:  r.score,
          reason: r.reason,
        })),
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: "Recommendations refreshed" });
  })
);

module.exports = router;
