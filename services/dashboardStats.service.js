const Movie = require("../models/movie.model");
const Purchase = require("../models/purchase.model");
const User = require("../models/user.model");
const DashboardStats = require("../models/dashboardStats.model");
const { cache } = require("./cache.service");
const { isDatabaseReady } = require("../config/db");

const DASHBOARD_STATS_KEY = "global";
const DASHBOARD_CACHE_KEY = "admin:dashboard:overview";
const DASHBOARD_CACHE_TTL_MS = 60 * 1000;

const toNumberMap = (items = []) => {
  const output = {};
  for (const item of items) {
    output[item._id] = item.count || 0;
  }
  return output;
};

const buildDashboardResponse = (stats) => ({
  success: true,
  message: "Dashboard overview fetched",
  data: {
    movies: {
      totalMoviesUploaded: stats.totalMovies || 0,
      activeMovies: stats.activeMovies || 0,
      inactiveMovies: stats.inactiveMovies || 0,
      revenuePerMovie: stats.revenuePerMovie || [],
      totalViews: stats.totalViews || 0,
    },
    customerActivity: {
      totalPurchases: stats.totalPurchases || 0,
      todaysRevenue: stats.todaysRevenue || 0,
      monthlyRevenue: stats.monthlyRevenue || 0,
      activeSubscriptions: stats.activeSubscriptions || 0,
      expiredUsers: stats.expiredUsers || 0,
      purchaseStatus: stats.purchaseStatus || {},
    },
    userManagement: {
      totalUsers: stats.totalUsers || 0,
      activeUsers: stats.activeUsers || 0,
      blockedUsers: stats.blockedUsers || 0,
      adminAccounts: stats.adminAccounts || 0,
    },
    charts: {
      revenue: stats.revenueChart || [],
      topMovies: stats.topMovies || [],
    },
    lastUpdated: stats.lastUpdated || null,
  },
});

const computeDashboardStats = async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [movieCounts, totalViewsAgg, userCounts, purchaseCounts, revenueAgg, movieRevenueAgg, monthlyRevenueAgg] =
    await Promise.all([
      Movie.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Movie.aggregate([{ $group: { _id: null, totalViews: { $sum: "$totalViews" } } }]),
      User.aggregate([
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
            blockedUsers: {
              $sum: {
                $cond: [{ $eq: ["$blocked", true] }, 1, 0],
              },
            },
            activeUsers: {
              $sum: {
                $cond: [
                  {
                    $and: [{ $eq: ["$role", "user"] }, { $eq: ["$blocked", false] }, { $eq: ["$isActive", true] }],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Purchase.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Purchase.aggregate([
        { $match: { status: "paid" } },
        {
          $group: {
            _id: null,
            totalRevenuePaise: { $sum: "$amount" },
            totalPurchases: { $sum: 1 },
            todaysRevenuePaise: {
              $sum: {
                $cond: [{ $gte: ["$paidAt", todayStart] }, "$amount", 0],
              },
            },
            monthlyRevenuePaise: {
              $sum: {
                $cond: [{ $gte: ["$paidAt", monthStart] }, "$amount", 0],
              },
            },
            activeSubscriptions: {
              $sum: {
                $cond: [{ $gt: ["$accessExpiresAt", now] }, 1, 0],
              },
            },
            expiredUsers: {
              $sum: {
                $cond: [{ $lte: ["$accessExpiresAt", now] }, 1, 0],
              },
            },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: { status: "paid" } },
        {
          $group: {
            _id: "$movie",
            revenue: { $sum: "$amount" },
            purchases: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "movies",
            localField: "_id",
            foreignField: "_id",
            as: "movie",
          },
        },
        { $unwind: "$movie" },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            movieId: "$movie._id",
            title: "$movie.title",
            revenue: { $divide: ["$revenue", 100] },
            purchases: "$purchases",
          },
        },
      ]),
      Purchase.aggregate([
        { $match: { status: "paid", paidAt: { $gte: monthStart } } },
        {
          $group: {
            _id: { $dayOfMonth: "$paidAt" },
            revenue: { $sum: "$amount" },
            purchases: { $sum: 1 },
          },
        },
        { $sort: { "_id": 1 } },
      ]),
    ]);

  const movieStats = toNumberMap(movieCounts);
  const purchaseStatus = toNumberMap(purchaseCounts);
  const userStats = userCounts.reduce(
    (accumulator, item) => {
      if (item._id === "admin") {
        accumulator.adminAccounts += item.count || 0;
        return accumulator;
      }

      accumulator.totalUsers += item.count || 0;
      accumulator.activeUsers += item.activeUsers || 0;
      accumulator.blockedUsers += item.blockedUsers || 0;
      return accumulator;
    },
    { totalUsers: 0, activeUsers: 0, blockedUsers: 0, adminAccounts: 0 }
  );
  const revenueStats = revenueAgg[0] || {
    totalRevenuePaise: 0,
    totalPurchases: 0,
    todaysRevenuePaise: 0,
    monthlyRevenuePaise: 0,
    activeSubscriptions: 0,
    expiredUsers: 0,
  };

  return {
    key: DASHBOARD_STATS_KEY,
    totalMovies: (movieStats.active || 0) + (movieStats.inactive || 0),
    activeMovies: movieStats.active || 0,
    inactiveMovies: movieStats.inactive || 0,
    totalUsers: userStats.totalUsers || 0,
    activeUsers: userStats.activeUsers || 0,
    blockedUsers: userStats.blockedUsers || 0,
    adminAccounts: userStats.adminAccounts || 0,
    totalRevenue: Number(revenueStats.totalRevenuePaise || 0) / 100,
    todaysRevenue: Number(revenueStats.todaysRevenuePaise || 0) / 100,
    monthlyRevenue: Number(revenueStats.monthlyRevenuePaise || 0) / 100,
    totalPurchases: revenueStats.totalPurchases || 0,
    activeSubscriptions: revenueStats.activeSubscriptions || 0,
    expiredUsers: revenueStats.expiredUsers || 0,
    totalViews: totalViewsAgg[0]?.totalViews || 0,
    purchaseStatus,
    revenuePerMovie: movieRevenueAgg,
    revenueChart: monthlyRevenueAgg.map((item) => ({
      label: `Day ${item._id}`,
      revenue: Number(item.revenue || 0) / 100,
      purchases: item.purchases || 0,
    })),
    topMovies: movieRevenueAgg.map((item) => ({
      label: item.title,
      revenue: item.revenue || 0,
      purchases: item.purchases || 0,
    })),
    lastUpdated: now,
  };
};

const refreshDashboardStats = async () => {
  if (!isDatabaseReady()) {
    throw new Error("Database not connected");
  }

  const stats = await computeDashboardStats();
  const updated = await DashboardStats.findOneAndUpdate(
    { key: DASHBOARD_STATS_KEY },
    { $set: stats },
    { upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
  );

  const responsePayload = buildDashboardResponse(updated);
  cache.set(DASHBOARD_CACHE_KEY, responsePayload, DASHBOARD_CACHE_TTL_MS);

  return updated;
};

const getCachedDashboardResponse = async () => {
  const cached = cache.get(DASHBOARD_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const stats = await DashboardStats.findOne({ key: DASHBOARD_STATS_KEY }).lean();
  if (!stats) {
    const refreshed = await refreshDashboardStats();
    return buildDashboardResponse(refreshed);
  }

  const responsePayload = buildDashboardResponse(stats);
  cache.set(DASHBOARD_CACHE_KEY, responsePayload, DASHBOARD_CACHE_TTL_MS);
  return responsePayload;
};

module.exports = {
  DASHBOARD_CACHE_KEY,
  buildDashboardResponse,
  refreshDashboardStats,
  getCachedDashboardResponse,
};
