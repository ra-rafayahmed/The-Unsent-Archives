const multer = require("multer");
const ApiError = require("../utils/ApiError");

const allowedMimes = {
  image: new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  audio: new Set(["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/aac"]),
};

const resolveMediaType = (mimetype) => {
  if (allowedMimes.image.has(mimetype)) return "image";
  if (allowedMimes.audio.has(mimetype)) return "audio";
  return null;
};

// Memory storage so binary lands directly in `req.file.buffer` and we can
// persist it to MongoDB instead of the local filesystem.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const mediaType = resolveMediaType(file.mimetype);

  if (!mediaType) {
    cb(new ApiError(400, "Only image and audio files are supported"));
    return;
  }

  req.uploadMediaType = mediaType;
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
};
