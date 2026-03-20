const fs = require("fs/promises");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const cloudinary = require("../config/cloudinary");

const CLOUDINARY_VIDEO_CHUNK_SIZE = 6000000;
const DEFAULT_UPLOAD_RETRIES = 3;

const buildChunkPublicId = ({ sessionId, chunkIndex }) =>
  `ott-tube/movie-chunks/${sessionId}/part-${String(chunkIndex + 1).padStart(5, "0")}`;

const retryAsync = async (fn, { retries = DEFAULT_UPLOAD_RETRIES, onRetry } = {}) => {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        break;
      }

      if (typeof onRetry === "function") {
        await onRetry(error, attempt, retries);
      }
    }
  }

  throw lastError;
};

const uploadLargeVideo = async (
  filePath,
  {
    folder = "movies/videos",
    public_id,
    overwrite = false,
    use_filename = false,
    unique_filename,
    invalidate,
    retries = DEFAULT_UPLOAD_RETRIES,
    ...options
  } = {}
) => {
  await fs.access(filePath);
  console.log(`[Cloudinary] Uploading: ${filePath}`);

  return retryAsync(
    () =>
      new Promise((resolve, reject) => {
        cloudinary.uploader.upload_large(
          filePath,
          {
            resource_type: "video",
            folder,
            chunk_size: CLOUDINARY_VIDEO_CHUNK_SIZE,
            overwrite,
            use_filename,
            ...(typeof public_id !== "undefined" ? { public_id } : {}),
            ...(typeof unique_filename !== "undefined" ? { unique_filename } : {}),
            ...(typeof invalidate !== "undefined" ? { invalidate } : {}),
            ...options,
          },
          (error, result) => {
            if (error) {
              return reject(error);
            }

            return resolve(result);
          }
        );
      }),
    {
      retries,
      onRetry: async (error, attempt, maxRetries) => {
        console.warn(
          `[Cloudinary] Large video upload attempt ${attempt} failed. Retrying (${attempt + 1}/${maxRetries})...`,
          error?.message || error
        );
      },
    }
  );
};

const uploadPoster = async (filePath, { folder = "ott-tube/posters" } = {}) => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: "image",
    overwrite: false,
    transformation: [
      { quality: "auto:best" },
      { fetch_format: "auto" },
    ],
  });

  return {
    url: result.url,
    secureUrl: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type || "image",
  };
};

const uploadChunk = async (
  filePath,
  { sessionId, chunkIndex, folder = "ott-tube/movie-chunks", context = {} } = {}
) => {
  const publicId = buildChunkPublicId({ sessionId, chunkIndex });
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    public_id: publicId,
    resource_type: "video",
    overwrite: true,
    use_filename: false,
    unique_filename: false,
    invalidate: true,
    context,
  });

  return {
    url: result.url,
    secureUrl: result.secure_url,
    publicId: result.public_id,
    etag: result.etag || crypto.randomUUID(),
    bytes: result.bytes || null,
    resourceType: result.resource_type || "video",
  };
};

const deleteMovieAssets = async ({ posterPublicId, chunkPublicIds = [], videoPublicIds = [] } = {}) => {
  const tasks = [];

  if (posterPublicId) {
    tasks.push(
      cloudinary.uploader.destroy(posterPublicId, {
        resource_type: "image",
        invalidate: true,
      })
    );
  }

  for (const publicId of [...chunkPublicIds, ...videoPublicIds].filter(Boolean)) {
    tasks.push(
      cloudinary.uploader.destroy(publicId, {
        resource_type: "video",
        invalidate: true,
      })
    );
  }

  return Promise.allSettled(tasks);
};

const removeTempFile = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

const downloadFromUrl = async (url, outputPath) => {
  const protocol = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    const file = require("fs").createWriteStream(outputPath);
    protocol.get(url, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        file.close();
        fs.unlink(outputPath).catch(() => {});
        return reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
      file.on("error", (err) => {
        fs.unlink(outputPath).catch(() => {});
        reject(err);
      });
    }).on("error", (err) => {
      fs.unlink(outputPath).catch(() => {});
      reject(err);
    });
  });
};

module.exports = {
  CLOUDINARY_VIDEO_CHUNK_SIZE,
  DEFAULT_UPLOAD_RETRIES,
  retryAsync,
  uploadLargeVideo,
  uploadPoster,
  uploadChunk,
  deleteMovieAssets,
  removeTempFile,
  downloadFromUrl,
};
