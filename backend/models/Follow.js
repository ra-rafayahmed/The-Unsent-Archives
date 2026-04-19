// models/Follow.js
// Stores user-to-user follow relationships.
// Design: Separate collection because this is many-to-many and unbounded
// (a user can follow thousands of people). Embedding in User would make
// documents huge. Queried independently of user profiles.

const mongoose = require("mongoose");
const { Schema } = mongoose;

const followSchema = new mongoose.Schema({
  followerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  followeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  followedAt: { type: Date, default: Date.now },
});

// Prevent a user from following the same person twice
followSchema.index({ followerId: 1, followeeId: 1 }, { unique: true });

// "Who do I follow?" — sorted by newest first
followSchema.index({ followerId: 1, followedAt: -1 });

// "Who follows me?" — sorted by newest first
followSchema.index({ followeeId: 1, followedAt: -1 });

module.exports = mongoose.model("Follow", followSchema);
