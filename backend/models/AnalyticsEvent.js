// models/AnalyticsEvent.js
// Tracks user interactions. TTL index auto-deletes events after 90 days.

const mongoose = require("mongoose");

const analyticsEventSchema = new mongoose.Schema({
  postId:    { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  actorId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  eventType: { type: String, enum: ["view", "click", "share", "save", "report"], required: true },
  ipHash:    { type: String },
  metadata: {
    userAgent: { type: String },
    referer:   { type: String },
    platform:  { type: String, enum: ["web", "mobile", "desktop"] },
  },
  occurredAt: { type: Date, default: Date.now },
});

// Auto-delete after 90 days
analyticsEventSchema.index({ occurredAt: 1 }, { expireAfterSeconds: 7776000 });
analyticsEventSchema.index({ postId: 1, eventType: 1, occurredAt: -1 });
analyticsEventSchema.index({ actorId: 1, eventType: 1, occurredAt: -1 });

module.exports = mongoose.model("AnalyticsEvent", analyticsEventSchema);
