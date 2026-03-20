const ApiError = require("../utils/ApiError");

const validateCreateOrderBody = (req, res, next) => {
  const { movieId } = req.params || {}; // NEW: From params
  if (!movieId || typeof movieId !== "string") {
    return next(new ApiError(400, "movieId is required"));
  }

  return next();
};

const validateVerifyPaymentBody = (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return next(new ApiError(400, "razorpay_order_id, razorpay_payment_id, razorpay_signature are required"));
  }

  return next();
};

module.exports = { validateCreateOrderBody, validateVerifyPaymentBody };
