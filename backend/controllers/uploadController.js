const path = require("path");
const { MediaAsset } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const buildPublicUrl = (req, assetId) => {
  // Absolute URL so it can be embedded directly as <img src> / <audio src>.
  return `${req.protocol}://${req.get("host")}/api/uploads/${assetId}/file`;
};

const uploadMedia = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, "File is required"));
  }

  const safeOriginal = (req.file.originalname || "upload").replace(/[^\w.-]/g, "_");
  const ext = path.extname(safeOriginal).toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

  const asset = await MediaAsset.create({
    ownerId: req.user.id,
    fileName,
    mimeType: req.file.mimetype,
    size: req.file.size,
    mediaType: req.uploadMediaType,
    data: req.file.buffer,
    url: "pending", // backfilled below once we have the _id
  });

  asset.url = buildPublicUrl(req, asset._id);
  await asset.save();

  // Strip the binary out of the response payload so we don't ship Mongo Buffer
  // metadata back to the browser.
  const assetView = asset.toObject();
  delete assetView.data;

  res.status(201).json({
    status: "success",
    asset: assetView,
  });
});

const listMyMedia = asyncHandler(async (req, res) => {
  const assets = await MediaAsset.find({ ownerId: req.user.id }).sort({ createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: assets.length,
    assets,
  });
});

const deleteMedia = asyncHandler(async (req, res, next) => {
  const asset = await MediaAsset.findById(req.params.id);

  if (!asset) {
    return next(new ApiError(404, "Media asset not found"));
  }

  if (asset.ownerId.toString() !== req.user.id) {
    return next(new ApiError(403, "Not authorized to delete this media asset"));
  }

  await asset.deleteOne();

  res.status(200).json({
    status: "success",
    message: "Media asset deleted",
  });
});

// @desc    Stream the stored bytes for a media asset
// @route   GET /api/uploads/:id/file
// @access  Public (assets are referenced from public posts/profiles)
const streamMedia = asyncHandler(async (req, res, next) => {
  const asset = await MediaAsset.findById(req.params.id).select("+data mimeType fileName size");

  if (!asset || !asset.data) {
    return next(new ApiError(404, "Media not found"));
  }

  res.setHeader("Content-Type", asset.mimeType || "application/octet-stream");
  res.setHeader("Content-Length", asset.size);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Content-Disposition", `inline; filename="${asset.fileName.replace(/"/g, "")}"`);

  res.end(asset.data);
});

module.exports = {
  listMyMedia,
  uploadMedia,
  deleteMedia,
  streamMedia,
};
