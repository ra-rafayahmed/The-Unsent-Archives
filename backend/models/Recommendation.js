// models/Recommendation.js
// Stores per-user recommendation profiles and cached recommended posts.
// Designed to be refreshed periodically (or on demand) rather than
// recomputed on every feed request.

const mongoose = require("mongoose");
const { Schema } = mongoose;

const recommendationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    // Weighted tag interest scores derived from engagement history
    tagInterests: [
      {
        tagId: { type: Schema.Types.ObjectId, ref: "Tag" },
        score: { type: Number, default: 0 },
      },
    ],

    // Per-author affinity scores (strong engagement with an author bumps their score)
    followingTrend: [
      {
        followedUserId: { type: Schema.Types.ObjectId, ref: "User" },
        score: { type: Number, default: 0 },
      },
    ],

    // Raw engagement history used to update the scores above
    // Weights: view=1, save=2, react=3, comment=5
    engagementHistory: [
      {
        postId:     { type: Schema.Types.ObjectId, ref: "Post" },
        engagement: { type: String, enum: ["view", "save", "react", "comment"] },
        weight:     { type: Number },
        timestamp:  { type: Date, default: Date.now },
      },
    ],

    // Pre-computed recommendation cache (refreshed on demand or by a background job)
    recommendedPosts: [
      {
        postId:    { type: Schema.Types.ObjectId, ref: "Post" },
        score:     { type: Number },
        reason:    { type: String, enum: ["tag-match", "collaborative-filter", "trending", "follow-network"] },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Note: userId already has an index via the unique:true constraint above.

module.exports = mongoose.model("Recommendation", recommendationSchema);
