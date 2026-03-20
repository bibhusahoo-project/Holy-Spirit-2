const cron = require("node-cron");
const { refreshDashboardStats } = require("./dashboardStats.service");

let dashboardStatsTask = null;

const runDashboardStatsRefresh = async () => {
  try {
    const stats = await refreshDashboardStats();
    console.log("[DashboardStats] refreshed", {
      totalMovies: stats.totalMovies,
      totalUsers: stats.totalUsers,
      totalRevenue: stats.totalRevenue,
      lastUpdated: stats.lastUpdated,
    });
  } catch (error) {
    console.error("[DashboardStats] refresh failed:", error.message);
  }
};

const startDashboardStatsJob = () => {
  if (dashboardStatsTask) {
    return dashboardStatsTask;
  }

  runDashboardStatsRefresh();
  dashboardStatsTask = cron.schedule("*/5 * * * *", runDashboardStatsRefresh, {
    timezone: "Asia/Calcutta",
  });

  return dashboardStatsTask;
};

module.exports = { startDashboardStatsJob, runDashboardStatsRefresh };
