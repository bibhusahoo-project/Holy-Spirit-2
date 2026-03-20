const fs = require("fs/promises");
const cloudinary = require("../config/cloudinary");
const { uploadLargeVideo } = require("./cloudinary");

const uploadMediaFromPath = async (filePath, options = {}) => {
  const resourceType = options.resourceType || options.resource_type || "auto";

  if (resourceType === "video") {
    return uploadLargeVideo(filePath, {
      folder: options.folder || "movie-rental",
      ...(options.public_id ? { public_id: options.public_id } : {}),
      overwrite: options.overwrite ?? false,
    });
  }

  return cloudinary.uploader.upload(filePath, {
    folder: options.folder || "movie-rental",
    resource_type: resourceType,
    ...(options.public_id ? { public_id: options.public_id } : {}),
    overwrite: options.overwrite ?? false,
  });
};

const deleteCloudinaryMedia = async (publicId, resourceType = "image") => {
  if (!publicId) {
    return null;
  }

  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

const removeTempFile = async (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

module.exports = {
  uploadMediaFromPath,
  deleteCloudinaryMedia,
  removeTempFile,
};
