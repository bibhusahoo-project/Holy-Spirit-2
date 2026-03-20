const { Readable } = require("stream");
const cloudinary = require("../config/cloudinary");

const uploadVideoChunkBuffer = (buffer, { publicId, folder = "ott-tube/movie-chunks" } = {}) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder,
        public_id: publicId,
        overwrite: true,
        use_filename: false,
        unique_filename: false,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        return resolve(result);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });

const uploadVideoBuffer = (buffer, { publicId, folder = "movie-rental/videos" } = {}) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder,
        public_id: publicId,
        overwrite: false,
        use_filename: false,
        unique_filename: !publicId,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        return resolve(result);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });

module.exports = {
  uploadVideoChunkBuffer,
  uploadVideoBuffer,
};
