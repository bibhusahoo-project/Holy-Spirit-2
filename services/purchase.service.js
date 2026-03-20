const Purchase = require("../models/purchase.model");

const markExpiredIfNeeded = async (purchase) => {
  if (!purchase) {
    return null;
  }

  if (purchase.status === "paid" && purchase.accessExpiresAt && purchase.accessExpiresAt <= new Date()) {
    purchase.status = "expired";
    await purchase.save();
  }

  return purchase;
};

const getActivePurchase = async (userId, movieId) => {
  const purchase = await Purchase.findOne({
    user: userId,
    movie: movieId,
    status: "paid",
    accessExpiresAt: { $gt: new Date() },
  });

  return purchase;
};

module.exports = { markExpiredIfNeeded, getActivePurchase };
