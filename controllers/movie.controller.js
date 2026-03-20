const mongoose = require("mongoose");
const Movie = require("../models/movie.model");
const Purchase = require("../models/purchase.model");
const Category = require("../models/category.model");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination, buildPaginationMeta } = require("../utils/pagination");
const { cache } = require("../services/cache.service");
const { uploadVideoChunkBuffer } = require("../services/cloudinary.service");

const buildMovieResponse = (movie, purchase = null) => {
  if (!movie) return null;

  return {
    id: movie._id,
    title: movie.title || "Untitled",
    description: movie.description || "",
    price: movie.price || 0,
    isRentable: true, // NEW: Always rentable if active
    rating: movie.rating || 0,
    language: movie.language || "Hindi",
    validityDays: movie.validityDays || 30,
    status: movie.status || "active",
    genres: Array.isArray(movie.genres) ? movie.genres : [],
    actors: Array.isArray(movie.actors) ? movie.actors : [],
    coverImageUrl: movie.poster?.secureUrl || movie.poster?.url || movie.coverImage?.secureUrl || movie.coverImage?.url || null,
    posterUrl: movie.poster?.secureUrl || movie.poster?.url || null,
    categories: Array.isArray(movie.categories)
      ? movie.categories
          .filter(Boolean)
          .map((category) => ({
            id: category._id || category.id || category,
            name: category.name || "Uncategorized",
          }))
      : [],
    videoUrl: movie.videoUrl || null,
    chunkCount: Number(movie.totalChunks || (Array.isArray(movie.videos) ? movie.videos.length : 0)),
    totalViews: movie.totalViews || 0,
    totalPurchases: movie.totalPurchases || 0,
    purchaseStatus: purchase
      ? {
          purchased: purchase.status === "paid" && purchase.accessExpiresAt > new Date(),
          purchaseDate: purchase.paidAt,
          expiryDate: purchase.accessExpiresAt,
          status: purchase.status,
        }
      : {
          purchased: false,
          purchaseDate: null,
          expiryDate: null,
          status: "not-purchased",
        },
    createdAt: movie.createdAt,
    updatedAt: movie.updatedAt,
  };
};

const buildStreamPayload = (movie) => {
  if (!movie) return {};

  // NEW: Multi-part support - use videos array if available
  if (movie.videos && Array.isArray(movie.videos) && movie.videos.length > 0) {
    const playlist = movie.videos
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((video) => ({
        part: video.partNumber,
        url: video.url,
        duration: video.duration || 0,
      }));

    return {
      watchType: "multi-part",
      playlist,
      watchLink: playlist[0]?.url || null,
    };
  }

  const playlist = (movie.movieChunks || [])
    .filter(Boolean)
    .map((chunk) => ({
      part: chunk.part,
      chunkIndex: chunk.chunkIndex,
      url: chunk.secureUrl || chunk.url,
      size: chunk.size,
    }));

  if (movie.videoUrl) {
    return {
      watchType: "single-video",
      playlist: [
        {
          part: 1,
          chunkIndex: 0,
          url: movie.videoUrl,
          size: null,
        },
      ],
      watchLink: movie.videoUrl,
    };
  }

  return {
    watchType: "sequential-chunks",
    playlist,
    watchLink: playlist[0]?.url || null,
  };
};

const getUserPurchaseMap = async (userId, movieIds) => {
  if (!userId || !movieIds.length) {
    return new Map();
  }

  const purchases = await Purchase.find({
    user: userId,
    movie: { $in: movieIds },
  })
    .sort({ createdAt: -1 })
    .lean();

  return new Map(purchases.map((purchase) => [String(purchase.movie), purchase]));
};

const ensureActiveAccess = async (userId, movieId) => {
  const movie = await Movie.findById(movieId).populate("categories", "name").lean();
  if (!movie || movie.status !== "Active") {
    throw new ApiError(404, "Movie not found");
  }

  const purchase = await Purchase.findOne({
    user: userId,
    movie: movie._id,
    status: "paid",
    accessExpiresAt: { $gt: new Date() },
  }).lean();

  if (!purchase) {
    throw new ApiError(403, "Movie access expired or not purchased");
  }

  return { movie, purchase };
};

const listMovies = asyncHandler(async (req, res) => {
  const { currentPage, limit, skip } = getPagination(req.query.page, req.query.limit);
  
  // Category filter support
  let query = { status: "Active" };
  const categoryIdOrSlug = req.query.category?.trim();
  if (categoryIdOrSlug) {
    query.categories = mongoose.Types.ObjectId.isValid(categoryIdOrSlug) 
      ? categoryIdOrSlug 
      : { $in: [await Category.findOne({ slug: categoryIdOrSlug })?._id] };
  }
  
  const cacheKey = `movies:list:${currentPage}:${limit}:${String(req.query.category || "all")}:${req.user?.id || "guest"}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  const [totalMovies, movies] = await Promise.all([
    Movie.countDocuments(query),
    Movie.find(query)
      .populate("categories", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const purchaseMap = await getUserPurchaseMap(
    req.user?.role === "user" ? req.user.id : null,
    movies.map((movie) => movie._id)
  );

  const responsePayload = {
    success: true,
    message: "Movies fetched successfully",
    items: movies.map((movie) => buildMovieResponse(movie, purchaseMap.get(String(movie._id)))),
    pagination: buildPaginationMeta(totalMovies, currentPage, limit)
  };
  cache.set(cacheKey, responsePayload, 30 * 1000);
  return res.status(200).json(responsePayload);
});

const getMovieDetails = asyncHandler(async (req, res) => {
  const movie = await Movie.findById(req.params.movieId).populate("categories", "name").lean();
  if (!movie || movie.status !== "Active") {
    throw new ApiError(404, "Movie not found");
  }

  let purchase = null;
  if (req.user?.role === "user") {
    purchase = await Purchase.findOne({ user: req.user.id, movie: movie._id }).sort({ createdAt: -1 }).lean();
  }

  return res.status(200).json({
    success: true,
    message: "Movie details fetched",
    data: buildMovieResponse(movie, purchase),
  });
});

const watchPurchasedMovie = asyncHandler(async (req, res) => {
  const { movie, purchase } = await ensureActiveAccess(req.user.id, req.params.movieId);
  const streamPayload = buildStreamPayload(movie);

  await Movie.updateOne({ _id: movie._id }, { $inc: { totalViews: 1 } });

  return res.status(200).json({
    success: true,
    message: "Watch access granted",
    data: {
      movie: buildMovieResponse(movie, purchase),
      accessExpiresAt: purchase.accessExpiresAt,
      ...streamPayload,
    },
  });
});

const streamPurchasedMovie = asyncHandler(async (req, res) => {
  const { movie, purchase } = await ensureActiveAccess(req.user.id, req.params.movieId);
  return res.status(200).json({
    success: true,
    message: "Stream playlist fetched successfully",
    data: {
      accessExpiresAt: purchase.accessExpiresAt,
      ...buildStreamPayload(movie),
    },
  });
});

const uploadMovieChunk = asyncHandler(async (req, res) => {
  const chunkFile = req.file;
  const movieId = String(req.body.movieId || "").trim();
  const chunkIndex = Number(req.body.chunkIndex);
  const totalChunks = Number(req.body.totalChunks);

  if (!chunkFile?.buffer?.length) {
    throw new ApiError(400, "chunk file is required");
  }
  if (!movieId || !/^[a-zA-Z0-9-_]{6,200}$/.test(movieId)) {
    throw new ApiError(400, "movieId is required");
  }
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new ApiError(400, "chunkIndex must be a non-negative integer");
  }

  // Cloudinary public ID format: movieId_chunk_index
  const publicId = `${movieId}_chunk_${chunkIndex}`;

  const uploadedChunk = await uploadVideoChunkBuffer(chunkFile.buffer, {
    publicId,
  });

  return res.status(200).json({
    chunkIndex,
    secure_url: uploadedChunk.secure_url,
  });
});

const createMovie = asyncHandler(async (req, res) => {
  const { title, description, price, language, validityDays, genres, categories, actors, rating, totalChunks, chunkUrls } = req.body;

  if (!title || !description || !totalChunks || !chunkUrls || !Array.isArray(chunkUrls)) {
    throw new ApiError(400, "Missing required movie data or chunk URLs");
  }

  // Prepare chunks for storage (already ordered by frontend, but we store index for safety)
  const formattedChunks = chunkUrls.map((url, index) => ({
    index,
    url,
  }));

  const movie = await Movie.create({
    title,
    description,
    price: price || 0,
    language: language || "Hindi",
    validityDays: validityDays || 30,
    genres: genres || [],
    categories: categories || [],
    actors: actors || [],
    rating: rating || 0,
    totalChunks,
    chunks: formattedChunks,
    createdBy: req.user?._id || req.user?.id,
    status: "Active",
  });

  return res.status(201).json({
    success: true,
    message: "Movie created successfully",
    data: movie,
  });
});

module.exports = { 
  listMovies, 
  getMovieDetails, 
  watchPurchasedMovie, 
  streamPurchasedMovie, 
  uploadMovieChunk,
  createMovie
};
