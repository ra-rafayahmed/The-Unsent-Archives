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

// TRIGGER: post-save → atomically bump the post's denormalized reactionCount
// so feeds can sort by popularity without aggregating across reactions.
reactionSchema.post("save", async function (doc) {
  try {
    await mongoose
      .model("Post")
      .findByIdAndUpdate(doc.postId, { $inc: { reactionCount: 1 } });
  } catch {
    // best-effort; counter drift is acceptable, source of truth is Reaction
  }
});

// TRIGGER: post-deleteOne → decrement, never below zero
reactionSchema.post("deleteOne", { document: true, query: false }, async function (doc) {
  try {
    await mongoose
      .model("Post")
      .updateOne(
        { _id: doc.postId, reactionCount: { $gt: 0 } },
        { $inc: { reactionCount: -1 } }
      );
  } catch {
    // swallow
  }
});

module.exports = mongoose.model("Reaction", reactionSchema);
