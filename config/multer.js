const path = require("path");
const multer = require("multer");
const fs = require("fs");
const env = require("./env");
const ApiError = require("../utils/ApiError");

const tempDir = path.join(process.cwd(), "uploads", "tmp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const safeBase = path
      .basename(file.originalname || "file", extension)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 60);
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    cb(null, `${safeBase || "file"}-${suffix}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "coverImage" && imageMimeTypes.has(file.mimetype)) {
    return cb(null, true);
  }

  if (file.fieldname === "video" && videoMimeTypes.has(file.mimetype)) {
    return cb(null, true);
  }

  return cb(new ApiError(400, `Invalid file type for ${file.fieldname}`));
};

const uploadMovieAssets = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxUploadSizeMb * 1024 * 1024,
  },
}).fields([
  { name: "coverImage", maxCount: 1 },
  { name: "video", maxCount: 10 },
]);
module.exports = { uploadMovieAssets };

// simple avatar upload middleware (single image)
const uploadAvatar = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (imageMimeTypes.has(file.mimetype)) return cb(null, true);
    return cb(new ApiError(400, "Invalid avatar file type"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("avatar");

module.exports.uploadAvatar = uploadAvatar;
