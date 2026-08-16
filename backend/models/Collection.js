// models/Collection.js
// User-curated lists of saved posts (bookmarks / playlists).
// postCount is denormalized for fast display without counting the array.

const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, maxlength: 500, default: "" },
    visibility: { type: String, enum: ["public", "private"], default: "private" },
    postIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
    postCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

collectionSchema.index({ ownerId: 1, createdAt: -1 });
collectionSchema.index({ visibility: 1, createdAt: -1 });
collectionSchema.index({ postIds: 1 });

module.exports = mongoose.model("Collection", collectionSchema);
