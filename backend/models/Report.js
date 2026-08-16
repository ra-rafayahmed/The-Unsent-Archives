// models/Report.js
// User-submitted reports against posts or accounts. Reviewed by admins from
// /admin endpoints. A POST hook on save bumps the soft-flag counter on the
// reported entity so admins can sort by "most reported".

const mongoose = require("mongoose");
const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["post", "user"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, refPath: "targetType" },
    reason: {
      type: String,
      enum: ["spam", "harassment", "hate", "self-harm", "nsfw", "impersonation", "other"],
      required: true,
    },
    note: { type: String, maxlength: 500, default: "" },
    status: {
      type: String,
      enum: ["open", "resolved", "dismissed"],
      default: "open",
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1, status: 1 });
reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: false });

// TRIGGER: post-save → increment the report counter on the target entity so
// admin lists can sort by `reportCount` without an aggregation query.
reportSchema.post("save", async function (doc, next) {
  try {
    if (doc.status !== "open") return next();
    const Model = mongoose.model(doc.targetType === "user" ? "User" : "Post");
    await Model.findByIdAndUpdate(doc.targetId, { $inc: { reportCount: 1 } });
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Report", reportSchema);
