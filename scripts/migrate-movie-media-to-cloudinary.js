require("dotenv").config();

const path = require("path");
const { connectDB } = require("../config/db");
const Movie = require("../models/movie.model");
const { uploadMediaFromPath, removeTempFile } = require("../utils/cloudinaryMedia");

const isLegacyMovie = (movie) =>
  Boolean(movie?.cover?.path) ||
  Boolean(movie?.video?.path) ||
  (!movie?.coverImage?.url && !movie?.videoFile?.url);

const resolveLegacyPath = (relativePath) => path.join(process.cwd(), "uploads", relativePath || "");

const migrateMovieMedia = async (movie, deleteLocal) => {
  const updates = {};
  const localFilesToDelete = [];

  if (movie.cover?.path && !movie.coverImage?.url) {
    const absoluteCoverPath = resolveLegacyPath(movie.cover.path);
    const uploadedCover = await uploadMediaFromPath(absoluteCoverPath, {
      folder: "movie-rental/covers",
      resourceType: "image",
    });
    updates.coverImage = {
      url: uploadedCover.secure_url,
      publicId: uploadedCover.public_id,
      resourceType: "image",
    };
    localFilesToDelete.push(absoluteCoverPath);
  }

  if (movie.video?.path && !movie.videoFile?.url) {
    const absoluteVideoPath = resolveLegacyPath(movie.video.path);
    const uploadedVideo = await uploadMediaFromPath(absoluteVideoPath, {
      folder: "movie-rental/videos",
      resourceType: "video",
    });
    updates.videoFile = {
      url: uploadedVideo.secure_url,
      publicId: uploadedVideo.public_id,
      resourceType: "video",
    };
    localFilesToDelete.push(absoluteVideoPath);
  }

  if (!Object.keys(updates).length) {
    return false;
  }

  await Movie.updateOne(
    { _id: movie._id },
    {
      $set: updates,
      $unset: { cover: 1, video: 1 },
    }
  );

  if (deleteLocal) {
    await Promise.allSettled(localFilesToDelete.map((filePath) => removeTempFile(filePath)));
  }

  return true;
};

const run = async () => {
  const execute = process.argv.includes("--execute");
  const deleteLocal = process.argv.includes("--delete-local");

  const connection = await connectDB();

  try {
    const movies = await Movie.find().lean();
    const legacyMovies = movies.filter(isLegacyMovie);

    console.log(`Total movies: ${movies.length}`);
    console.log(`Legacy media movies: ${legacyMovies.length}`);

    if (!execute) {
      console.log("Dry run complete. Re-run with --execute to perform migration.");
      return;
    }

    let migratedCount = 0;
    for (const movie of legacyMovies) {
      const migrated = await migrateMovieMedia(movie, deleteLocal);
      if (migrated) {
        migratedCount += 1;
      }
    }

    console.log(`Migrated movies: ${migratedCount}`);
    console.log("Migration completed.");
  } finally {
    await connection.disconnect();
  }
};

run().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
