// services/recommendationService.js
//
// Implements the recommendation algorithm described in
// docs/rec-sys-implementation.md.
//
// Public API:
//   getRecommendations(userId, limit)     -> ranked Post array (full docs)
//   refreshRecommendations(userId, limit) -> recompute and persist into the
//                                            user's Recommendation doc
//   logEngagement(userId, postId, type)   -> append an engagement event,
//                                            evolve tag/author affinity scores
//
// All errors are logged but never thrown to the caller — recommendations are a
// best-effort enhancement, not a critical path.

const mongoose = require("mongoose");
const { Post, Reaction, Follow, User, Recommendation } = require("../models");
const logger = require("../utils/logger");

// -- Tuning constants ------------------------------------------------------

const TAG_SCORE_PER_MATCH = 10;
const COLLABORATIVE_SCORE = 8;
const FOLLOW_SCORE = 12;
const TRENDING_WINDOW_DAYS = 7;
const REACTION_WEIGHT = 2;
const VIEW_WEIGHT = 0.5;

// Per-engagement weight on the *interest profile* (not the per-post score).
// Used by logEngagement to bump tagInterests / followingTrend.
const ENGAGEMENT_WEIGHT = {
  view: 1,
  save: 2,
  react: 3,
  comment: 5,
};

const DEFAULT_LIMIT = 30;

// -- Helpers ---------------------------------------------------------------

const toObjectId = (id) =>
  id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);

const idStr = (id) => (id?._id ? id._id.toString() : id?.toString?.());

const bump = (map, postId, delta, reason) => {
  const key = idStr(postId);
  if (!key) return;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, { postId: toObjectId(key), score: delta, reason });
  } else {
    existing.score += delta;
    // Keep the strongest reason: follow > tag > collaborative > trending
    const order = { "follow-network": 4, "tag-match": 3, "collaborative-filter": 2, trending: 1 };
    if ((order[reason] || 0) > (order[existing.reason] || 0)) {
      existing.reason = reason;
    }
  }
};

// -- Strategies ------------------------------------------------------------

// 1. Tag-based filtering — combine User.tagInterests + Recommendation.tagInterests
const _addTagBasedRecs = async (userId, scores) => {
  const [user, profile] = await Promise.all([
    User.findById(userId).select("tagInterests"),
    Recommendation.findOne({ userId }).select("tagInterests"),
  ]);

  const tagIdSet = new Set();
  (user?.tagInterests || []).forEach((t) => tagIdSet.add(idStr(t)));
  (profile?.tagInterests || []).forEach((t) => {
    if (t.score > 0) tagIdSet.add(idStr(t.tagId));
  });

  if (tagIdSet.size === 0) return;

  const tagIds = [...tagIdSet].map((id) => toObjectId(id));
  const posts = await Post.find({
    tagIds: { $in: tagIds },
    visibility: "public",
    authorId: { $ne: toObjectId(userId) },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .select("tagIds");

  for (const post of posts) {
    const matched = post.tagIds.filter((tid) => tagIdSet.has(idStr(tid))).length;
    if (matched > 0) {
      bump(scores, post._id, matched * TAG_SCORE_PER_MATCH, "tag-match");
    }
  }
};

// 2. Collaborative filtering — users who reacted to the same posts you reacted to
const _addCollaborativeRecs = async (userId, scores) => {
  const myReactions = await Reaction.find({ userId: toObjectId(userId) })
    .select("postId")
    .limit(200);
  const engagedPostIds = myReactions.map((r) => r.postId);
  if (engagedPostIds.length === 0) return;

  const similarUsers = await Reaction.distinct("userId", {
    postId: { $in: engagedPostIds },
    userId: { $ne: toObjectId(userId) },
  });
  if (similarUsers.length === 0) return;

  const candidatePostIds = await Reaction.distinct("postId", {
    userId: { $in: similarUsers },
    postId: { $nin: engagedPostIds },
  });
  if (candidatePostIds.length === 0) return;

  const posts = await Post.find({
    _id: { $in: candidatePostIds },
    visibility: "public",
    authorId: { $ne: toObjectId(userId) },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .select("_id");

  for (const post of posts) {
    bump(scores, post._id, COLLABORATIVE_SCORE, "collaborative-filter");
  }
};

// 3. Trending — recent posts ranked by engagement, with a positional decay
const _addTrendingRecs = async (userId, scores) => {
  const cutoff = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const posts = await Post.find({
    visibility: "public",
    authorId: { $ne: toObjectId(userId) },
    createdAt: { $gte: cutoff },
  })
    .sort({ reactionCount: -1, viewCount: -1 })
    .limit(30)
    .select("_id reactionCount viewCount");

  posts.forEach((post, index) => {
    const recencyDecay = 1 / (index + 1);
    const engagementScore =
      (post.reactionCount || 0) * REACTION_WEIGHT + (post.viewCount || 0) * VIEW_WEIGHT;
    bump(scores, post._id, engagementScore * recencyDecay, "trending");
  });
};

// 4. Follow network — recent posts from users you follow
const _addFollowNetworkRecs = async (userId, scores) => {
  const follows = await Follow.find({ followerId: toObjectId(userId) }).select("followeeId");
  if (follows.length === 0) return;

  const followeeIds = follows.map((f) => f.followeeId);
  const posts = await Post.find({
    authorId: { $in: followeeIds },
    visibility: { $in: ["public", "followers"] },
  })
    .sort({ createdAt: -1 })
    .limit(40)
    .select("_id");

  for (const post of posts) {
    bump(scores, post._id, FOLLOW_SCORE, "follow-network");
  }
};

// -- Public API ------------------------------------------------------------

/**
 * Compute the ranked recommendation list for a user. Does NOT persist.
 * @returns Array<{ postId, score, reason }>
 */
const computeRanked = async (userId, limit = DEFAULT_LIMIT) => {
  if (!userId) return [];
  const scores = new Map();

  // Run independently; one strategy failing must not kill the others.
  await Promise.allSettled([
    _addTagBasedRecs(userId, scores),
    _addCollaborativeRecs(userId, scores),
    _addTrendingRecs(userId, scores),
    _addFollowNetworkRecs(userId, scores),
  ]);

  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit);
};

/**
 * Compute, persist into the user's Recommendation doc, and return ranked recs
 * with hydrated Post documents (suitable for the frontend feed).
 */
const refreshRecommendations = async (userId, limit = DEFAULT_LIMIT) => {
  const ranked = await computeRanked(userId, limit);

  if (ranked.length === 0) return [];

  // Persist the cache (best-effort)
  try {
    await Recommendation.findOneAndUpdate(
      { userId: toObjectId(userId) },
      {
        userId: toObjectId(userId),
        recommendedPosts: ranked.map((r) => ({
          postId: r.postId,
          score: r.score,
          reason: r.reason,
          createdAt: new Date(),
        })),
        lastUpdated: new Date(),
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    logger.warn({ err }, "[recs] failed to persist recommendation cache");
  }

  return hydrateRanked(ranked);
};

/**
 * Hydrate raw ranked entries into full Post docs preserving order/score/reason.
 */
const hydrateRanked = async (ranked) => {
  if (ranked.length === 0) return [];
  const ids = ranked.map((r) => r.postId);
  const posts = await Post.find({ _id: { $in: ids } })
    .populate("authorId", "username avatarUrl")
    .populate("tagIds", "name slug");

  const byId = new Map(posts.map((p) => [p._id.toString(), p]));
  return ranked
    .map((r) => {
      const post = byId.get(idStr(r.postId));
      if (!post) return null;
      const obj = post.toObject();
      obj._recScore = r.score;
      obj._recReason = r.reason;
      return obj;
    })
    .filter(Boolean);
};

/**
 * Return the user's recommendations. Uses the cached list if it's fresh,
 * otherwise recomputes and persists.
 */
const getRecommendations = async (
  userId,
  limit = DEFAULT_LIMIT,
  { ttlMs = 30 * 60 * 1000 } = {}
) => {
  if (!userId) return [];

  const cache = await Recommendation.findOne({ userId: toObjectId(userId) }).select(
    "recommendedPosts lastUpdated"
  );

  const fresh =
    cache &&
    cache.lastUpdated &&
    Date.now() - new Date(cache.lastUpdated).getTime() < ttlMs &&
    cache.recommendedPosts.length > 0;

  if (fresh) {
    const ranked = cache.recommendedPosts.slice(0, limit).map((r) => ({
      postId: r.postId,
      score: r.score,
      reason: r.reason,
    }));
    const hydrated = await hydrateRanked(ranked);
    if (hydrated.length > 0) return hydrated;
  }

  return refreshRecommendations(userId, limit);
};

/**
 * Append an engagement event and evolve the user's interest profile.
 * Best-effort, never throws.
 */
const logEngagement = async (userId, postId, engagement) => {
  if (!userId || !postId) return;
  if (!ENGAGEMENT_WEIGHT[engagement]) return;

  const weight = ENGAGEMENT_WEIGHT[engagement];

  try {
    const post = await Post.findById(postId).select("tagIds authorId isAnonymous");
    if (!post) return;

    const profile = await Recommendation.findOneAndUpdate(
      { userId: toObjectId(userId) },
      { $setOnInsert: { userId: toObjectId(userId) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    profile.engagementHistory.push({
      postId: post._id,
      engagement,
      weight,
      timestamp: new Date(),
    });

    // Evolve tagInterests
    const tagMap = new Map(profile.tagInterests.map((t) => [idStr(t.tagId), t]));
    for (const tid of post.tagIds || []) {
      const key = idStr(tid);
      const existing = tagMap.get(key);
      if (existing) existing.score += weight;
      else tagMap.set(key, { tagId: tid, score: weight });
    }
    profile.tagInterests = [...tagMap.values()];

    // Evolve followingTrend (only if author isn't anonymous)
    if (post.authorId && !post.isAnonymous) {
      const authorMap = new Map(profile.followingTrend.map((t) => [idStr(t.followedUserId), t]));
      const key = idStr(post.authorId);
      const existing = authorMap.get(key);
      if (existing) existing.score += weight;
      else authorMap.set(key, { followedUserId: post.authorId, score: weight });
      profile.followingTrend = [...authorMap.values()];
    }

    await profile.save();
  } catch (err) {
    logger.warn({ err }, "[recs] logEngagement failed");
  }
};

module.exports = {
  getRecommendations,
  refreshRecommendations,
  computeRanked,
  logEngagement,
  // Tuning constants exported for tests / admin tooling
  TUNING: {
    TAG_SCORE_PER_MATCH,
    COLLABORATIVE_SCORE,
    FOLLOW_SCORE,
    TRENDING_WINDOW_DAYS,
    REACTION_WEIGHT,
    VIEW_WEIGHT,
    ENGAGEMENT_WEIGHT,
  },
};
