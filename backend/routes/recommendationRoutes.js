const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const RecommendationService = require("../services/recommendationService");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { refreshRecommendationsSchema } = require("../validators/interactionValidator");

// @desc    Get personalized recommendations for the signed-in user
// @route   GET /api/recommendations
// @access  Private
router.get(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const posts = await RecommendationService.getRecommendations(req.user.id, limit);

    // Anonymize if needed (mirrors feed/search/etc.)
    const cleaned = posts.map((p) => {
      if (p.isAnonymous && (!req.user || p.authorId?._id?.toString() !== req.user.id)) {
        p.authorId = null;
      }
      return p;
    });

    res.status(200).json({
      status: "success",
      results: cleaned.length,
      posts: cleaned,
    });
  })
);

// @desc    Force a recompute + cache refresh (e.g. when the user pulls to refresh)
// @route   POST /api/recommendations/refresh
// @access  Private
router.post(
  "/refresh",
  auth,
  validate(refreshRecommendationsSchema),
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, Math.max(1, parseInt(req.body.limit, 10) || 30));
    const posts = await RecommendationService.refreshRecommendations(req.user.id, limit);

    const cleaned = posts.map((p) => {
      if (p.isAnonymous && (!req.user || p.authorId?._id?.toString() !== req.user.id)) {
        p.authorId = null;
      }
      return p;
    });

    res.status(200).json({
      status: "success",
      results: cleaned.length,
      posts: cleaned,
    });
  })
);

module.exports = router;
