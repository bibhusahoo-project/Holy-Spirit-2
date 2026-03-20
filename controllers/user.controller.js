const Purchase = require("../models/purchase.model");
const User = require("../models/user.model");
const asyncHandler = require("../utils/asyncHandler");
const { uploadPoster, removeTempFile } = require("../utils/cloudinary");
const ApiError = require("../utils/ApiError");

const getMyMovies = asyncHandler(async (req, res) => {
  const purchases = await Purchase.find({
    user: req.user.id,
    status: "paid",
    accessExpiresAt: { $gt: new Date() }, // NEW: Only non-expired
  })
    .populate("movie", "title description price poster coverImage videos validityDays")
    .sort({ createdAt: -1 })
    .lean();

  const movies = purchases
    .filter((purchase) => purchase.movie)
    .map((purchase) => ({
      purchaseId: purchase._id,
      movieId: purchase.movie._id,
      title: purchase.movie.title,
      description: purchase.movie.description,
      price: purchase.movie.price,
      posterUrl: purchase.movie.poster?.secureUrl || purchase.movie.poster?.url || purchase.movie.coverImage?.secureUrl || purchase.movie.coverImage?.url,
      purchasedAt: purchase.paidAt,
      expiryDate: purchase.accessExpiresAt,
      paymentStatus: purchase.status,
      amountPaid: (purchase.amount || 0) / 100,
      partsCount: purchase.movie.videos?.length || 1, // NEW: Multi-part support
      canWatch: true, // Already filtered
      watchLink: `/watch/${purchase.movie._id}`,
    }));

  return res.status(200).json({
    success: true,
    message: "Purchased movies fetched successfully",
    data: movies,
  });
});

// NEW: Get user profile
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) throw new ApiError(404, "User not found");

  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    data: {
      id: user._id,
      mobile: user.mobile,
      name: user.name,
      email: user.email,
      username: user.username,
      phone: user.phone,
      bio: user.bio,
      avatar: user.avatar,
      role: user.role,
      blocked: user.blocked,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, username, email, phone, bio } = req.body || {};
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  if (email) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
    if (exists) {
      throw new ApiError(409, "Email already in use");
    }
    user.email = normalizedEmail;
  }

  if (typeof name !== "undefined") user.name = String(name).trim();
  if (typeof username !== "undefined") user.username = String(username).trim();
  if (typeof phone !== "undefined") user.phone = String(phone).trim();
  if (typeof bio !== "undefined") user.bio = String(bio).trim();

  if (req.file?.path) {
    const uploadedAvatar = await uploadPoster(req.file.path, {
      folder: `ott-tube/avatars/${req.user.id}`,
    });
    user.avatar = uploadedAvatar.secureUrl || uploadedAvatar.url;
  }

  await user.save();
  await removeTempFile(req.file?.path);

  return res.status(200).json({
    success: true,
    message: "Profile updated",
    data: {
      id: user._id,
      mobile: user.mobile,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      bio: user.bio,
      avatar: user.avatar,
      role: user.role,
      blocked: user.blocked,
    },
  });
});

const getTransactions = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Purchase.find({ user: req.user.id })
      .populate("movie", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Purchase.countDocuments({ user: req.user.id }),
  ]);

  return res.status(200).json({
    success: true,
    message: "Transactions fetched successfully",
    data: items.map((purchase) => ({
      id: purchase._id,
      movieId: purchase.movie?._id || null,
      movieTitle: purchase.movie?.title || "Unknown",
      amount: (purchase.amount || 0) / 100,
      paymentStatus: purchase.status,
      orderId: purchase.razorpayOrderId,
      paymentId: purchase.razorpayPaymentId,
      purchaseDate: purchase.paidAt,
      expiryDate: purchase.accessExpiresAt,
      createdAt: purchase.createdAt,
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

module.exports = { getMyMovies, getProfile, updateProfile, getTransactions };
