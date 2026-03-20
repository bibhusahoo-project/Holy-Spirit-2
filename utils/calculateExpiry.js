const env = require("../config/env");

const calculateExpiryDate = (startDate = new Date(), validityDays = env.rentalDurationDays) => {
  const expiry = new Date(startDate);
  expiry.setDate(expiry.getDate() + Math.max(1, Number(validityDays) || env.rentalDurationDays));
  return expiry;
};

module.exports = { calculateExpiryDate };
