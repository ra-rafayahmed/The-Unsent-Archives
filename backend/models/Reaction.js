// models/Reaction.js
// Emoji reactions on posts.
// Separate collection — reactions are unbounded and write-heavy.
// Embedding in Post would push popular posts toward the 16MB document limit.
// Service functions increment Post.reactionCount atomically after each reaction.

const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema({
  postId:    { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type:      { type: String, enum: ["like", "love", "haha", "wow", "sad", "angry"], required: true },
  reactedAt: { type: Date, default: Date.now },
});

reactionSchema.index({ postId: 1, userId: 1, type: 1 }, { unique: true });
reactionSchema.index({ postId: 1, type: 1 });
reactionSchema.index({ userId: 1, reactedAt: -1 });

module.exports = mongoose.model("Reaction", reactionSchema);
