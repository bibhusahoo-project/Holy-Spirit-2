const cron = require("node-cron");
const Purchase = require("../models/purchase.model");
const { isDatabaseReady } = require("../config/db");

const revokeExpiredAccess = async () => {
  if (!isDatabaseReady()) {
    return 0;
  }

  const now = new Date();
  const result = await Purchase.updateMany(
    {
      status: "paid",
      accessExpiresAt: { $lte: now },
    },
    {
      $set: {
        status: "expired",
      },
    }
  );

  return result.modifiedCount || 0;
};

const startExpiryCleanupJob = () => {
  const run = async () => {
    try {
      const updatedCount = await revokeExpiredAccess();
      if (updatedCount > 0) {
        console.log("[Purchases] expired access revoked", { updatedCount });
      }
    } catch (error) {
      console.error("Failed to revoke expired access:", error.message);
    }
  };

  run();
  return cron.schedule("0 * * * *", run, {
    timezone: "Asia/Calcutta",
  });
};

module.exports = { revokeExpiredAccess, startExpiryCleanupJob };
