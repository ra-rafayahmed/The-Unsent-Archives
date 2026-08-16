// models/SearchIndex.js
// Denormalized search-optimized shadow collection.
// Lean copy of post data used for $text search — avoids scanning large Post documents.
// Kept in sync by the service layer on create/edit/delete.

const mongoose = require("mongoose");

const searchIndexSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true, unique: true },
    contentTokens: { type: String, default: "" },
    tagSlugs: [{ type: String }],
    authorUsername: { type: String },
    visibility: { type: String, enum: ["public", "followers", "private"] },
  },
  { timestamps: true }
);

searchIndexSchema.index(
  { contentTokens: "text", authorUsername: "text", tagSlugs: "text" },
  { weights: { contentTokens: 3, tagSlugs: 2, authorUsername: 1 } }
);
searchIndexSchema.index({ visibility: 1, createdAt: -1 });

module.exports = mongoose.model("SearchIndex", searchIndexSchema);
