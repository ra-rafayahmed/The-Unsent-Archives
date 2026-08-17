// models/Post.js
// The core content collection — unsent letters/posts.
//
// EMBED vs REFERENCE decisions:
//  - comments  → EMBEDDED: bounded (we cap at 500), always loaded with the post
//  - reactions → REFERENCED: unbounded, write-heavy, queried independently
//  - tags      → BOTH: tagIds (ref for metadata), tagSlugs (denormalized for fast filtering)
//
// DENORMALIZATION: viewCount, reactionCount, saveCount stored here so the
// feed doesn't need to aggregate across millions of reaction/analytics docs.

const mongoose = require("mongoose");
const { Schema } = mongoose;

// Embedded comment sub-document
const commentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 1000 },
    isAnonymous: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// Media attachment sub-document
const mediaSchema = new Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ["image", "video", "audio"], required: true },
    mimeType: { type: String },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false }
);

// Visual style sub-document (font, background for styled posts)
const styleSchema = new Schema(
  {
    font: { type: String, default: "sans-serif" },
    background: { type: String, default: "#ffffff" },
    textColor: { type: String, default: "#1a1a1a" },
    fontSize: { type: Number, default: 1.15 },
    lineHeight: { type: Number, default: 1.6 },
    letterSpacing: { type: Number, default: 0 },
    textAlign: { type: String, enum: ["left", "center", "right", "justify"], default: "left" },
  },
  { _id: false }
);

const postSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, minlength: 1, maxlength: 5000 },
    visibility: { type: String, enum: ["public", "followers", "private"], default: "public" },
    isAnonymous: { type: Boolean, default: false },

    // Self-reference: reposted posts point to the original
    repostOf: { type: Schema.Types.ObjectId, ref: "Post", default: null },

    style: { type: styleSchema, default: () => ({}) },
    media: { type: [mediaSchema], default: [] },

    // Tag IDs for full metadata; slugs denormalized for fast filtering without join
    tagIds: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
    tagSlugs: [{ type: String }],

    // Denormalized counters — updated with $inc for atomic, race-condition-free increments
    viewCount: { type: Number, default: 0 },
    reactionCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },

    // Embedded comments — bounded at 500 in the service layer
    comments: { type: [commentSchema], default: [] },
  },
  { timestamps: true }
);

// Indexes
postSchema.index({ authorId: 1, createdAt: -1 }); // user's own posts feed
postSchema.index({ visibility: 1, createdAt: -1 }); // explore feed
postSchema.index({ tagSlugs: 1, createdAt: -1 }); // posts by tag
postSchema.index({ content: "text", tagSlugs: "text" }); // full-text search

// TRIGGER: pre-validate → normalize tag slugs (lowercase, kebab-case)
postSchema.pre("validate", function () {
  if (Array.isArray(this.tagSlugs)) {
    this.tagSlugs = this.tagSlugs
      .filter(Boolean)
      .map((s) => String(s).toLowerCase().trim().replace(/\s+/g, "-"));
  }
  // Cap embedded comments at 500 — write-side guard, not just service-layer
  if (Array.isArray(this.comments) && this.comments.length > 500) {
    this.comments = this.comments.slice(-500);
  }
});

// TRIGGER: post-save → keep the SearchIndex collection in sync with new
// content / tagSlugs / visibility on every write. Avoids drift if a service
// path skips the explicit index update.
postSchema.post("save", async function (doc) {
  try {
    const SearchIndex = mongoose.model("SearchIndex");
    await SearchIndex.findOneAndUpdate(
      { postId: doc._id },
      {
        postId: doc._id,
        contentTokens: doc.content,
        tagSlugs: doc.tagSlugs,
        visibility: doc.visibility,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch {
    // best-effort, never block the write
  }
});

// TRIGGER: post-deleteOne (document) → cascade clean up dependent rows
postSchema.post("deleteOne", { document: true, query: false }, async function (doc) {
  try {
    const Reaction = mongoose.model("Reaction");
    const AnalyticsEvent = mongoose.model("AnalyticsEvent");
    const SearchIndex = mongoose.model("SearchIndex");
    const Collection = mongoose.model("Collection");
    const Tag = mongoose.model("Tag");
    const Report = mongoose.model("Report");
    await Promise.all([
      Reaction.deleteMany({ postId: doc._id }),
      AnalyticsEvent.deleteMany({ postId: doc._id }),
      SearchIndex.deleteOne({ postId: doc._id }),
      Collection.updateMany(
        { postIds: doc._id },
        { $pull: { postIds: doc._id }, $inc: { postCount: -1 } }
      ),
      Tag.updateMany({ _id: { $in: doc.tagIds || [] } }, { $inc: { usageCount: -1 } }),
      Report.deleteMany({ targetType: "post", targetId: doc._id }),
    ]);
  } catch {
    // swallow — cleanup is idempotent and best-effort
  }
});

module.exports = mongoose.model("Post", postSchema);
