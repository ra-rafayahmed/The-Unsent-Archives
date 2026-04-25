const fs = require("fs/promises");
const path = require("path");
const { MediaAsset } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const toPublicUrl = (req, uploadPath) => {
  const normalized = uploadPath.replace(/\\/g, "/");
  return `${req.protocol}://${req.get("host")}/${normalized}`;
};

const uploadMedia = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, "File is required"));
  }

  const relativePath = path.join("uploads", req.uploadMediaType === "image" ? "images" : "audio", req.file.filename);
  const url = toPublicUrl(req, relativePath);

  const asset = await MediaAsset.create({
    ownerId: req.user.id,
    url,
    fileName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    mediaType: req.uploadMediaType,
  });

  res.status(201).json({
    status: "success",
    asset,
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

  const parsed = new URL(asset.url);
  const relativePath = parsed.pathname.startsWith("/") ? parsed.pathname.slice(1) : parsed.pathname;
  const fullPath = path.join(__dirname, "..", relativePath);

  await asset.deleteOne();

  try {
    await fs.unlink(fullPath);
  } catch {
    // Ignore disk cleanup failures when metadata is already removed.
  }

  res.status(200).json({
    status: "success",
    message: "Media asset deleted",
  });
});

module.exports = {
  listMyMedia,
  uploadMedia,
  deleteMedia,
};
