const multer = require("multer");
const ApiError = require("../utils/ApiError");

const allowedVideoMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "application/octet-stream",
  "",
]);

const uploadChunkMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedVideoMimeTypes.has(file.mimetype)) {
      return cb(new ApiError(400, "Unsupported chunk file type"));
    }

    return cb(null, true);
  },
}).single("chunk");

const uploadSingleVideoMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedVideoMimeTypes.has(file.mimetype)) {
      return cb(new ApiError(400, "Unsupported video file type"));
    }

    return cb(null, true);
  },
}).single("video");

module.exports = {
  uploadChunkMiddleware,
  uploadSingleVideoMiddleware,
};
