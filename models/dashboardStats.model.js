const mongoose = require("mongoose");

const chartPointSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    revenue: { type: Number, default: 0, min: 0 },
    purchases: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const revenuePerMovieSchema = new mongoose.Schema(
  {
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: "Movie", required: true },
    title: { type: String, required: true, trim: true },
    revenue: { type: Number, default: 0, min: 0 },
    purchases: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const dashboardStatsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "global",
      unique: true,
      index: true,
      immutable: true,
    },
    totalMovies: { type: Number, default: 0, min: 0 },
    activeMovies: { type: Number, default: 0, min: 0 },
    inactiveMovies: { type: Number, default: 0, min: 0 },
    totalUsers: { type: Number, default: 0, min: 0 },
    activeUsers: { type: Number, default: 0, min: 0 },
    blockedUsers: { type: Number, default: 0, min: 0 },
    adminAccounts: { type: Number, default: 0, min: 0 },
    totalRevenue: { type: Number, default: 0, min: 0 },
    todaysRevenue: { type: Number, default: 0, min: 0 },
    monthlyRevenue: { type: Number, default: 0, min: 0 },
    totalPurchases: { type: Number, default: 0, min: 0 },
    activeSubscriptions: { type: Number, default: 0, min: 0 },
    expiredUsers: { type: Number, default: 0, min: 0 },
    totalViews: { type: Number, default: 0, min: 0 },
    purchaseStatus: {
      type: Map,
      of: Number,
      default: {},
    },
    revenuePerMovie: {
      type: [revenuePerMovieSchema],
      default: [],
    },
    revenueChart: {
      type: [chartPointSchema],
      default: [],
    },
    topMovies: {
      type: [chartPointSchema],
      default: [],
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("DashboardStats", dashboardStatsSchema);
