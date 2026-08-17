// models/Recommendation.js
// One document per user. Holds:
//   - Per-tag and per-author affinity scores (updated as the user engages)
//   - A bounded engagement-event history (used to evolve those scores)
//   - A pre-computed list of recommended posts (cache)
//
// Spec: docs/rec-sys-implementation.md

const mongoose = require("mongoose");
const { Schema } = mongoose;

const tagInterestSchema = new Schema(
  {
    tagId: { type: Schema.Types.ObjectId, ref: "Tag", required: true },
    score: { type: Number, default: 0 },
  },
  { _id: false }
);

const followingTrendSchema = new Schema(
  {
    followedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    score: { type: Number, default: 0 },
  },
  { _id: false }
);

const engagementSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    engagement: { type: String, enum: ["view", "save", "react", "comment"], required: true },
    weight: { type: Number, default: 1 },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const recommendedPostSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    score: { type: Number, default: 0 },
    reason: {
      type: String,
      enum: ["tag-match", "collaborative-filter", "trending", "follow-network"],
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const recommendationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    tagInterests: { type: [tagInterestSchema], default: [] },
    followingTrend: { type: [followingTrendSchema], default: [] },
    engagementHistory: { type: [engagementSchema], default: [] },
    recommendedPosts: { type: [recommendedPostSchema], default: [] },
    lastUpdated: { type: Date, default: null },
  },
  { timestamps: true }
);

// TRIGGER: pre-validate → cap engagement history so this doc can't grow forever.
// We keep the most recent 500 events; older ones have already shaped the
// tagInterests / followingTrend scores.
recommendationSchema.pre("validate", function () {
  if (Array.isArray(this.engagementHistory) && this.engagementHistory.length > 500) {
    this.engagementHistory = this.engagementHistory.slice(-500);
  }
  if (Array.isArray(this.recommendedPosts) && this.recommendedPosts.length > 200) {
    this.recommendedPosts = this.recommendedPosts.slice(0, 200);
  }
});

module.exports = mongoose.model("Recommendation", recommendationSchema);
