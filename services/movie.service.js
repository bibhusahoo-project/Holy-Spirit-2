const Movie = require("../models/movie.model");
const Category = require("../models/category.model");
const ApiError = require("../utils/ApiError");
const { uploadPoster } = require("../utils/cloudinary");

const resolveCreatorId = (reqUserId) => (reqUserId === "admin" ? "000000000000000000000001" : reqUserId);

const normalizeGenres = (genres, tags) => {
  const values = [];
  const source = Array.isArray(genres) ? genres : typeof genres === "string" ? genres.split(",") : [];
  for (const item of source) {
    const normalized = String(item || "").trim();
    if (normalized) values.push(normalized);
  }
  if (Array.isArray(tags)) {
    for (const item of tags) {
      const normalized = String(item || "").trim();
      if (normalized && !values.includes(normalized)) values.push(normalized);
    }
  }
  return values;
};

const resolveCategories = async (categories) => {
  const categoryInput = Array.isArray(categories) ? categories : categories ? [categories] : [];
  const categoryIds = [];

  for (const cat of categoryInput) {
    if (!cat || typeof cat !== "string") continue;
    const trimmed = cat.trim();
    if (!trimmed) continue;

    if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
      const existing = await Category.findById(trimmed);
      if (existing) categoryIds.push(existing._id);
      continue;
    }

    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    let category = await Category.findOne({ name: trimmed });
    if (!category) {
      category = await Category.create({ name: trimmed, slug });
    }
    categoryIds.push(category._id);
  }

  return categoryIds;
};

const createMovie = async ({
  title,
  description,
  rating,
  actors,
  price,
  categories,
  language,
  validityDays,
  status,
  genres,
  tags,
  coverFile,
  videoUrl,
  movieChunks,
  totalChunks,
  createdBy,
}) => {
  if (!title || !description) {
    throw new ApiError(400, "title and description are required");
  }

  if (!coverFile) {
    throw new ApiError(400, "coverImage is required");
  }

  const normalizedVideoUrl = String(videoUrl || "").trim() || null;
  const normalizedMovieChunks = Array.isArray(movieChunks)
    ? movieChunks
        .map((chunk, index) => ({
          part: Number(chunk?.part || chunk?.index || index + 1),
          chunkIndex:
            typeof chunk?.chunkIndex !== "undefined"
              ? Number(chunk.chunkIndex)
              : typeof chunk?.index !== "undefined"
              ? Math.max(Number(chunk.index) - 1, 0)
              : index,
          url: String(chunk?.url || "").trim(),
          size: Number(chunk?.size || 0),
        }))
        .filter((chunk) => chunk.url)
        .sort((left, right) => left.part - right.part)
    : [];

  if (!normalizedVideoUrl && !normalizedMovieChunks.length) {
    throw new ApiError(400, "Either videoUrl or movieChunks is required");
  }
  if (normalizedMovieChunks.length && Number.isFinite(Number(totalChunks)) && Number(totalChunks) !== normalizedMovieChunks.length) {
    throw new ApiError(400, "totalChunks does not match provided movieChunks");
  }

  const poster = await uploadPoster(coverFile.path);

  const categoryIds = await resolveCategories(categories);

  const movie = await Movie.create({
    title: String(title).trim(),
    description: String(description).trim(),
    rating: Number(rating || 0),
    actors: Array.isArray(actors) ? actors : typeof actors === "string" ? actors.split(",").map((v) => v.trim()).filter(Boolean) : [],
    price: Number(price || 0),
    language: String(language || "Hindi").trim(),
    validityDays: Math.max(1, Number(validityDays) || 30),
    status: String(status || "Active").toLowerCase() === "inactive" ? "inactive" : "Active",
    genres: normalizeGenres(genres, tags),
    poster,
    coverImage: poster,
    categories: categoryIds,
    videoUrl: normalizedVideoUrl,
    totalChunks: normalizedVideoUrl ? 1 : normalizedMovieChunks.length,
    movieChunks: normalizedMovieChunks,
    createdBy: resolveCreatorId(createdBy),
  });

  return movie;
};

module.exports = {
  createMovie,
  resolveCategories,
};
