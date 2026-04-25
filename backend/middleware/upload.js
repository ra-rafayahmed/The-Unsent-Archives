const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const ApiError = require("../utils/ApiError");

const uploadsRoot = path.join(__dirname, "..", "uploads");
const uploadsImages = path.join(uploadsRoot, "images");
const uploadsAudio = path.join(uploadsRoot, "audio");

[uploadsRoot, uploadsImages, uploadsAudio].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const allowedMimes = {
  image: new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  audio: new Set(["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4"]),
};

const resolveMediaType = (mimetype) => {
  if (allowedMimes.image.has(mimetype)) return "image";
  if (allowedMimes.audio.has(mimetype)) return "audio";
  return null;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mediaType = resolveMediaType(file.mimetype);

    if (!mediaType) {
      return cb(new ApiError(400, "Unsupported file type"));
    }

    req.uploadMediaType = mediaType;
    cb(null, mediaType === "image" ? uploadsImages : uploadsAudio);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const mediaType = resolveMediaType(file.mimetype);

  if (!mediaType) {
    cb(new ApiError(400, "Only image and audio files are supported"));
    return;
  }

  cb(null, true);
};

const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
}).single("file");

module.exports = {
  uploadSingle,
  uploadsRoot,
};
