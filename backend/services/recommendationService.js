// services/recommendationService.js
// Core recommendation algorithm.
//
// Four independent strategies produce scored post candidates; scores from
// multiple strategies are additive so a post matching several signals rises
// to the top of the ranked list.
//
// Strategy weights (default scores per hit):
//   follow-network      12  (explicit follow = strongest intent signal)
//   tag-match           10 × matched-tag-count
//   collaborative-filter 8
//   trending            engagement-score × recency-decay

const { User, Post, Reaction, Follow } = require("../models");

class RecommendationService {
  /**
   * Return ranked recommendation objects for `userId`.
   *
   * @param {string|ObjectId} userId
   * @param {number}          limit   Maximum posts to return (default 20, max 100)
   * @returns {Promise<Array<{postId, score, reason}>>}
   */
  static async getRecommendations(userId, limit = 20) {
    const safeLimit = Math.min(limit, 100);

    const user = await User.findById(userId).populate("tagInterests");
    if (!user) throw new Error("User not found");

    // Accumulator: postId (string) → { postId, score, reason }
    const recommendations = new Map();

    await Promise.all([
      RecommendationService._addTagBasedRecs(userId, user.tagInterests || [], recommendations),
      RecommendationService._addCollaborativeRecs(userId, recommendations),
      RecommendationService._addTrendingRecs(userId, recommendations),
      RecommendationService._addFollowNetworkRecs(userId, recommendations),
    ]);

    return Array.from(recommendations.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, safeLimit);
  }

  // ---------------------------------------------------------------------------
  // Strategy 1 – Tag-based filtering
  // ---------------------------------------------------------------------------
  static async _addTagBasedRecs(userId, tagInterests, recommendations) {
    if (!tagInterests.length) return;

    const tagIds = tagInterests.map((t) => t._id);

    const posts = await Post.find({
      tagIds:     { $in: tagIds },
      authorId:   { $ne: userId },
      visibility: "public",
    })
      .limit(50)
      .lean();

    posts.forEach((post) => {
      const matchedCount = (post.tagIds || []).filter((id) =>
        tagIds.some((uTag) => uTag.toString() === id.toString())
      ).length;

      const score = matchedCount * 10;
      const key   = post._id.toString();

      if (recommendations.has(key)) {
        recommendations.get(key).score += score;
      } else {
        recommendations.set(key, { postId: post._id, score, reason: "tag-match" });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Strategy 2 – Collaborative filtering
  // ---------------------------------------------------------------------------
  static async _addCollaborativeRecs(userId, recommendations) {
    // Posts this user has already reacted to
    const userReactions = await Reaction.find({ userId }).select("postId").lean();
    const engagedPostIds = userReactions.map((r) => r.postId);

    if (!engagedPostIds.length) return;

    // Other users who reacted to the same posts
    const similarUserIds = await Reaction.find({
      postId: { $in: engagedPostIds },
      userId: { $ne: userId },
    }).distinct("userId");

    if (!similarUserIds.length) return;

    // Collect posts that similar users have reacted to (not authored by them)
    const similarUserReactions = await Reaction.find({
      userId: { $in: similarUserIds },
      postId: { $nin: engagedPostIds }, // exclude posts this user already reacted to
    })
      .select("postId")
      .lean();

    const candidatePostIds = [...new Set(similarUserReactions.map((r) => r.postId.toString()))];

    if (!candidatePostIds.length) return;

    const posts = await Post.find({
      _id:        { $in: candidatePostIds },
      visibility: "public",
      authorId:   { $ne: userId },
    })
      .limit(50)
      .lean();

    posts.forEach((post) => {
      const key = post._id.toString();
      if (recommendations.has(key)) {
        recommendations.get(key).score += 8;
      } else {
        recommendations.set(key, { postId: post._id, score: 8, reason: "collaborative-filter" });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Strategy 3 – Trending posts (last 7 days)
  // ---------------------------------------------------------------------------
  static async _addTrendingRecs(userId, recommendations) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trending = await Post.find({
      createdAt:  { $gte: oneWeekAgo },
      visibility: "public",
      authorId:   { $ne: userId },
    })
      .sort({ reactionCount: -1, viewCount: -1 })
      .limit(30)
      .lean();

    trending.forEach((post, index) => {
      const recencyDecay    = 1 / (index + 1);
      const engagementScore = (post.reactionCount || 0) * 2 + (post.viewCount || 0) * 0.5;
      const score           = engagementScore * recencyDecay;

      const key = post._id.toString();
      if (recommendations.has(key)) {
        recommendations.get(key).score += score;
      } else {
        recommendations.set(key, { postId: post._id, score, reason: "trending" });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Strategy 4 – Follow network
  // ---------------------------------------------------------------------------
  static async _addFollowNetworkRecs(userId, recommendations) {
    const follows = await Follow.find({ followerId: userId }).select("followeeId").lean();
    const followeeIds = follows.map((f) => f.followeeId);

    if (!followeeIds.length) return;

    const posts = await Post.find({
      authorId:   { $in: followeeIds },
      visibility: { $in: ["public", "followers"] },
    })
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();

    posts.forEach((post) => {
      const key = post._id.toString();
      if (recommendations.has(key)) {
        recommendations.get(key).score += 12;
      } else {
        recommendations.set(key, { postId: post._id, score: 12, reason: "follow-network" });
      }
    });
  }
}

module.exports = RecommendationService;
