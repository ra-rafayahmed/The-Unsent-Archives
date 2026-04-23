// models/Tag.js
// Reusable topic tags. Single source of truth — posts store tagIds (ref) + tagSlugs (denorm).
// Separate collection so tag metadata (usageCount, category) can be queried
// independently for trending tags, category browsing, etc.

const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema({
  name:       { type: String, required: true, unique: true, maxlength: 60 },
  slug:       { type: String, required: true, unique: true, lowercase: true,
                match: /^[a-z0-9-]+$/ },
  category:   { type: String, enum: ["emotion", "creative", "wellness", "nostalgia", "other"],
                default: "other" },
  usageCount: { type: Number, default: 0 },
});

// tagSchema.index({ slug: 1 }); // Removed to fix duplicate index warning
tagSchema.index({ category: 1 });
tagSchema.index({ usageCount: -1 });
tagSchema.index({ name: "text", slug: "text" });

module.exports = mongoose.model("Tag", tagSchema);
