const Movie = require("../models/movie.model");
const Purchase = require("../models/purchase.model");
const User = require("../models/user.model");
const Category = require("../models/category.model");
const Tag = require("../models/tag.model");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { getPagination } = require("../utils/pagination");
const { parseActors } = require("../utils/parseActors");
const { uploadPoster, deleteMovieAssets, removeTempFile, uploadLargeVideo } = require("../utils/cloudinary");
const { uploadVideoBuffer } = require("../services/cloudinary.service");
const { cache } = require("../services/cache.service");
const { getCachedDashboardResponse, DASHBOARD_CACHE_KEY } = require("../services/dashboardStats.service");

const SYSTEM_ADMIN_OBJECT_ID = "000000000000000000000001";
const resolveCreatorId = (reqUserId) => (reqUserId === "admin" ? SYSTEM_ADMIN_OBJECT_ID : reqUserId);

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

const toMovieResponse = (movie, extra = {}) => {
  if (!movie) return null;
  
  return {
    id: movie._id,
    title: movie.title || "Untitled",
    description: movie.description || "",
    price: movie.price || 0,
    rating: movie.rating || 0,
    actors: Array.isArray(movie.actors) ? movie.actors : [],
    language: movie.language || "Hindi",
    validityDays: movie.validityDays || 30,
    status: movie.status || "active",
    genres: Array.isArray(movie.genres) ? movie.genres : [],
    coverImageUrl: movie.poster?.secureUrl || movie.poster?.url || movie.coverImage?.secureUrl || movie.coverImage?.url || null,
    posterUrl: movie.poster?.secureUrl || movie.poster?.url || null,
    posterPublicId: movie.poster?.publicId || null,
    videoUrl: movie.videoUrl || null,
    totalChunks: Number(
      movie.totalChunks ||
        (Array.isArray(movie.videos) ? movie.videos.length : 0) ||
        (Array.isArray(movie.movieChunks) ? movie.movieChunks.length : 0)
    ),
    totalViews: movie.totalViews || 0,
    totalPurchases: movie.totalPurchases || 0,
    totalRevenue: movie.totalRevenue || 0,
    category: movie.category && typeof movie.category === "object" 
      ? { id: movie.category._id || movie.category.id, name: movie.category.name || "Uncategorized" } 
      : null,
    categories: Array.isArray(movie.categories) 
      ? movie.categories
          .filter(Boolean)
          .map((cat) => ({ 
            id: typeof cat === "object" ? (cat._id || cat.id) : cat, 
            name: typeof cat === "object" ? (cat.name || "Uncategorized") : "Uncategorized" 
          })) 
      : [],
    videos: Array.isArray(movie.videos)
      ? movie.videos
          .filter(Boolean)
          .map((v) => ({
            partNumber: v.partNumber,
            url: v.url,
            publicId: v.public_id,
          }))
      : [],
    createdAt: movie.createdAt,
    updatedAt: movie.updatedAt,
    ...extra,
  };
};

const resolveCategories = async (categories) => {
  const categoryInput = Array.isArray(categories) ? categories : categories ? [categories] : [];
  let categoryIds = [];
  for (const cat of categoryInput) {
    if (!cat || typeof cat !== 'string') continue;
    const trimmed = cat.trim();
    if (!trimmed) continue;

    // Check if it's an ObjectId (existing category)
    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      const category = await Category.findById(trimmed);
      if (category) {
        categoryIds.push(category._id);
      }
    } else {
      // It's a name, find or create
      const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let category = await Category.findOne({ name: trimmed });
      if (!category) {
        category = await Category.create({ name: trimmed, slug });
      }
      categoryIds.push(category._id);
    }
  }
  return categoryIds;
};

const cloudinary = require("../config/cloudinary");

const uploadMovieVideos = async (videoFiles = []) => {
  const videoResults = [];

  for (let i = 0; i < videoFiles.length; i += 1) {
    const videoFile = videoFiles[i];
    const partNumber = i + 1;

    console.log(
      `[UploadMovie] [Part ${partNumber}/${videoFiles.length}] Starting upload for: ${videoFile.originalname} (${videoFile.size} bytes)`
    );

    const videoRes = await uploadLargeVideo(videoFile.path, {
      folder: "movies/videos",
    });

    const videoUrl = videoRes.secure_url || videoRes.url;
    const publicId = videoRes.public_id;

    if (!videoUrl || !publicId) {
      throw new Error(`Cloudinary upload failed for part ${partNumber}`);
    }

    videoResults.push({
      partNumber,
      url: videoUrl,
      public_id: publicId,
    });

    console.log(`[UploadMovie] [Part ${partNumber}] Upload successful: ${videoUrl}`);
  }

  return videoResults;
};

const uploadMovie = asyncHandler(async (req, res) => {
  const videoFiles = req.files?.video;
  const coverFile = req.files?.coverImage?.[0];
  const normalizedTitle = String(req.body.title || "").trim();
  const normalizedDescription = String(req.body.description || "").trim();

  console.log(`[UploadMovie] Received ${videoFiles?.length || 0} video files and ${coverFile ? "1" : "0"} cover image`);

  if (!normalizedTitle) {
    return res.status(400).json({ success: false, message: "Title is required" });
  }

  if (!normalizedDescription) {
    return res.status(400).json({ success: false, message: "Description is required" });
  }

  if (!videoFiles || videoFiles.length === 0) {
    console.warn("[UploadMovie] No video file provided. Returning 400.");
    return res.status(400).json({ success: false, message: "No video file provided" });
  }

  const isMultiPart = req.body.isMultiPart === "true" || req.body.isMultiPart === true;
  let videoResults = [];
  let coverData = null;

  try {
    // Stage 1: Upload Video(s) (Cloudinary Large)
    const filesToUpload = isMultiPart ? videoFiles : videoFiles.slice(0, 1);
    videoResults = await uploadMovieVideos(filesToUpload);

    const primaryVideoUrl = videoResults[0]?.url || null;

    // Stage 2: Upload Cover Image (Optional)
    if (coverFile) {
      console.log(`[UploadMovie] Starting cover image upload for: ${coverFile.originalname} (size: ${coverFile.size} bytes)`);
      const imgRes = await cloudinary.uploader.upload(coverFile.path, {
        folder: "movie_covers",
        resource_type: "image",
      });
      console.log(`[UploadMovie] Cover image upload successful. Public ID: ${imgRes.public_id}, URL: ${imgRes.secure_url}`);
      coverData = {
        url: imgRes.url,
        secureUrl: imgRes.secure_url,
        publicId: imgRes.public_id,
        resourceType: "image",
      };
    }

    // Stage 3: Resolve Categories
    // Use categories from body, ensuring it's an array for resolveCategories
    const categoriesInput = req.body.categories || req.body.category;
    console.log(`[UploadMovie] Resolving categories with input:`, categoriesInput);
    const categoryIds = await resolveCategories(categoriesInput);
    console.log(`[UploadMovie] Resolved category IDs: ${categoryIds.join(", ")}`);

    // Stage 4: Create Movie in DB
    console.log("[UploadMovie] Creating movie entry in database with video URL:", primaryVideoUrl);
    const movie = await Movie.create({
      title: normalizedTitle,
      description: normalizedDescription,
      price: Number(req.body.price || 0),
      language: req.body.language || "Hindi",
      validityDays: Number(req.body.validityDays || 30),
      genres: normalizeGenres(req.body.genres),
      categories: categoryIds,
      actors: parseActors(req.body.actors),
      rating: Number(req.body.rating || 0),
      videos: videoResults,
      videoUrl: primaryVideoUrl,
      totalChunks: videoResults.length,
      isMultiPart: isMultiPart,
      poster: coverData,
      coverImage: coverData,
      createdBy: resolveCreatorId(req.user?.id || req.user?._id),
      status: req.body.status || "Active",
    });

    cache.del(DASHBOARD_CACHE_KEY);

    return res.status(201).json({
      success: true,
      message: "Movie uploaded successfully",
      data: toMovieResponse(movie),
    });
  } catch (err) {
    console.error("Upload failed:", err);
    await deleteMovieAssets({
      posterPublicId: coverData?.publicId,
      videoPublicIds: videoResults.map((video) => video.public_id),
    });
    throw new ApiError(500, `Upload failed: ${err.message}`);
  } finally {
    // Cleanup temp files
    if (videoFiles) {
      for (const f of videoFiles) {
        await removeTempFile(f.path);
      }
    }
    if (coverFile) {
      await removeTempFile(coverFile.path);
    }
  }
});

const uploadVideoAsset = asyncHandler(async (req, res) => {
  const videoFile = req.file;
  if (!videoFile?.buffer?.length) {
    throw new ApiError(400, "video file is required");
  }

  const uploadedVideo = await uploadVideoBuffer(videoFile.buffer, {
    publicId: `movie-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  });

  return res.status(200).json({
    success: true,
    message: "Video uploaded successfully",
    data: {
      videoUrl: uploadedVideo.secure_url || uploadedVideo.url,
      publicId: uploadedVideo.public_id,
    },
  });
});

const updateMovie = asyncHandler(async (req, res) => {
  const movie = await Movie.findById(req.params.movieId);
  if (!movie) {
    throw new ApiError(404, "Movie not found");
  }

  const previousVideoPublicIds = Array.isArray(movie.videos)
    ? movie.videos.map((video) => video.public_id).filter(Boolean)
    : [];
  const previousPosterPublicId = movie.poster?.publicId || null;
  const categoriesInput = req.body.categories || req.body.category;
  const categoryIds = await resolveCategories(categoriesInput);
  const coverFile = req.files?.coverImage?.[0];
  const videoFiles = req.files?.video || [];
  let uploadedPoster = null;
  let uploadedVideos = null;

  try {
    if (typeof req.body.title !== "undefined") movie.title = String(req.body.title).trim();
    if (typeof req.body.description !== "undefined") movie.description = String(req.body.description).trim();
    if (typeof req.body.price !== "undefined") movie.price = Number(req.body.price);
    if (typeof req.body.rating !== "undefined") movie.rating = Number(req.body.rating || 0);
    if (typeof req.body.actors !== "undefined") movie.actors = parseActors(req.body.actors);
    if (typeof req.body.language !== "undefined") movie.language = String(req.body.language || "Hindi").trim();
    if (typeof req.body.validityDays !== "undefined") movie.validityDays = Math.max(1, Number(req.body.validityDays));
    if (typeof req.body.status !== "undefined") {
      movie.status = String(req.body.status).toLowerCase() === "inactive" ? "inactive" : "Active";
    }
    movie.genres = normalizeGenres(req.body.genres);
    movie.categories = categoryIds;

    if (videoFiles.length > 0) {
      uploadedVideos = await uploadMovieVideos(videoFiles);
      movie.videos = uploadedVideos;
      movie.videoUrl = uploadedVideos[0]?.url || null;
      movie.totalChunks = uploadedVideos.length;
    }

    if (coverFile) {
      uploadedPoster = await uploadPoster(coverFile.path);
      movie.poster = uploadedPoster;
      movie.coverImage = uploadedPoster;
    }

    if (typeof req.body.videoUrl !== "undefined") {
      movie.videoUrl = String(req.body.videoUrl || "").trim() || null;
    }
    if (typeof req.body.videos !== "undefined") {
      let parsedVideos;
      try {
        parsedVideos = typeof req.body.videos === "string" ? JSON.parse(req.body.videos) : req.body.videos;
      } catch {
        throw new ApiError(400, "videos must be valid JSON");
      }
      movie.videos = Array.isArray(parsedVideos) ? parsedVideos : [];
      if (typeof req.body.videoUrl === "undefined") {
        movie.videoUrl = movie.videos[0]?.url || null;
      }
    }
    movie.totalChunks = Array.isArray(movie.videos) ? movie.videos.length : 0;

    await movie.save();

    if (uploadedPoster && previousPosterPublicId) {
      await deleteMovieAssets({ posterPublicId: previousPosterPublicId });
    }
    if (uploadedVideos) {
      await deleteMovieAssets({
        videoPublicIds: previousVideoPublicIds,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Movie updated successfully",
      data: toMovieResponse(movie),
    });
  } catch (error) {
    await deleteMovieAssets({
      posterPublicId: uploadedPoster?.publicId,
      videoPublicIds: (uploadedVideos || []).map((video) => video.public_id),
    });
    throw error;
  } finally {
    for (const file of videoFiles) {
      await removeTempFile(file?.path);
    }
    await removeTempFile(coverFile?.path);
  }
});

const getAllMovies = asyncHandler(async (req, res) => {
  const { currentPage, limit, skip } = getPagination(req.query.page, req.query.limit);
  const query = {};
  if (req.query.status) {
    const statusVal = String(req.query.status).toLowerCase();
    // Model uses "Active" and "inactive". Align "active" -> "Active".
    query.status = statusVal === "active" ? "Active" : statusVal;
  }

  const [totalItems, movies] = await Promise.all([
    Movie.countDocuments(query),
    Movie.find(query)
      .populate("categories", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    message: "All movies fetched",
    data: movies.map((movie) => toMovieResponse(movie)),
    meta: {
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      currentPage,
      limit,
    },
  });
});

const getMovieById = asyncHandler(async (req, res) => {
  const movie = await Movie.findById(req.params.movieId).populate("categories", "name").lean();
  if (!movie) {
    throw new ApiError(404, "Movie not found");
  }
  return res.status(200).json({
    success: true,
    message: "Movie details fetched",
    data: toMovieResponse(movie),
  });
});

const getAllUsers = asyncHandler(async (req, res) => {
  const { currentPage, limit, skip } = getPagination(req.query.page, req.query.limit);
  const [totalItems, users] = await Promise.all([
    User.countDocuments({ role: "user" }),
    User.find({ role: "user" })
      .select("_id mobile name email blocked createdAt lastLoginAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    message: "All users fetched",
    data: users.map((user) => ({
      id: user._id,
      mobile: user.mobile,
      name: user.name,
      email: user.email,
      blocked: user.blocked,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    })),
    meta: {
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      currentPage,
      limit,
    },
  });
});

const getAllPurchases = asyncHandler(async (req, res) => {
  const { currentPage, limit, skip } = getPagination(req.query.page, req.query.limit);
  const [totalItems, purchases] = await Promise.all([
    Purchase.countDocuments(),
    Purchase.find()
      .populate("user", "mobile name email")
      .populate("movie", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    message: "All purchases fetched",
    data: purchases.map((purchase) => ({
      id: purchase._id,
      user: purchase.user
        ? {
            id: purchase.user._id,
            mobile: purchase.user.mobile,
            name: purchase.user.name,
            email: purchase.user.email,
          }
        : null,
      movie: purchase.movie ? { id: purchase.movie._id, title: purchase.movie.title } : null,
      amount: (purchase.amount || 0) / 100,
      status: purchase.status,
      purchaseDate: purchase.paidAt,
      expiryDate: purchase.accessExpiresAt,
      paymentId: purchase.razorpayPaymentId,
      orderId: purchase.razorpayOrderId,
      createdAt: purchase.createdAt,
    })),
    meta: {
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      currentPage,
      limit,
    },
  });
});

const getDashboardOverview = asyncHandler(async (_req, res) => {
  return res.status(200).json(await getCachedDashboardResponse());
});

const deleteMovie = asyncHandler(async (req, res) => {
  const movie = await Movie.findById(req.params.movieId);
  if (!movie) {
    throw new ApiError(404, "Movie not found");
  }

  await deleteMovieAssets({
    posterPublicId: movie.poster?.publicId,
    videoPublicIds: Array.isArray(movie.videos) ? movie.videos.map((video) => video.public_id) : [],
  });

  await Movie.deleteOne({ _id: movie._id });
  cache.del(DASHBOARD_CACHE_KEY);

  return res.status(200).json({
    success: true,
    message: "Movie deleted successfully",
    data: null,
  });
});

module.exports = {
  uploadMovie,
  uploadVideoAsset,
  getAllMovies,
  getMovieById,
  getAllUsers,
  getAllPurchases,
  getDashboardOverview,
  updateMovie,
  deleteMovie,
};
