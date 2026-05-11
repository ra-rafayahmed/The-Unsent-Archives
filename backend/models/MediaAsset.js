const mongoose = require("mongoose");

const mediaAssetSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    mediaType: { type: String, enum: ["image", "audio"], required: true },
    // Binary contents stored directly in Mongo so files are not tied to local disk.
    // `select: false` keeps list/find queries lightweight.
    data: { type: Buffer, select: false },
  },
  { timestamps: true }
);

mediaAssetSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model("MediaAsset", mediaAssetSchema);
