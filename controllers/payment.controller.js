const crypto = require("crypto");
const razorpayClient = require("../config/razorpay");
const Movie = require("../models/movie.model");
const Purchase = require("../models/purchase.model");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { calculateExpiryDate } = require("../utils/calculateExpiry");
const env = require("../config/env");

const createOrder = asyncHandler(async (req, res) => {
  const { movieId } = req.params; // NEW: From params
  if (!movieId) {
    throw new ApiError(400, "movieId is required");
  }

  const movie = await Movie.findById(movieId).select("_id title price validityDays status").lean();
  if (!movie || movie.status !== "Active") {
    throw new ApiError(404, "Movie not found");
  }

  const activePurchase = await Purchase.findOne({
    user: req.user.id,
    movie: movie._id,
    status: "paid",
    accessExpiresAt: { $gt: new Date() },
  }).lean();

  if (activePurchase) {
    throw new ApiError(409, "You already purchased this movie and your access is still active");
  }

  const amountPaise = Math.max(100, Math.round(Number(movie.price || 0) * 100));
  const receipt = `ott_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const order = await razorpayClient.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt,
    notes: {
      userId: req.user.id,
      movieId: String(movie._id),
      movieTitle: movie.title,
    },
  });

  await Purchase.create({
    user: req.user.id,
    movie: movie._id,
    amount: amountPaise,
    currency: "INR",
    razorpayOrderId: order.id,
    status: "pending",
  });

  return res.status(201).json({
    success: true,
    message: "Razorpay order created",
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.razorpayKeyId,
      movie: {
        id: movie._id,
        title: movie.title,
        price: movie.price,
        validityDays: movie.validityDays,
      },
      paymentOptions: {
        upi: true,
        qrCode: true,
        gpayNumber: process.env.BUSINESS_GPAY_NUMBER || "",
        gateway: "razorpay",
      },
    },
  });
});

const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, "razorpay_order_id, razorpay_payment_id, razorpay_signature are required");
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(400, "payment verification failed");
  }

  const purchase = await Purchase.findOne({
    user: req.user.id,
    razorpayOrderId: razorpay_order_id,
  });
  if (!purchase) {
    throw new ApiError(404, "Order not found");
  }

  if (purchase.status === "paid") {
    return res.status(200).json({
      success: true,
      message: "Payment already verified",
      data: {
        purchaseId: purchase._id,
        movieId: purchase.movie,
        expiryDate: purchase.accessExpiresAt,
      },
    });
  }

  const movie = await Movie.findById(purchase.movie).select("_id validityDays totalPurchases totalRevenue");
  if (!movie) {
    throw new ApiError(404, "Movie not found");
  }

  purchase.razorpayPaymentId = razorpay_payment_id;
  purchase.razorpaySignature = razorpay_signature;
  purchase.status = "paid";
  purchase.paidAt = new Date();
  purchase.accessExpiresAt = calculateExpiryDate(new Date(), movie.validityDays || env.rentalDurationDays);
  await purchase.save();

  await Movie.updateOne(
    { _id: movie._id },
    {
      $inc: {
        totalPurchases: 1,
        totalRevenue: (purchase.amount || 0) / 100,
      },
    }
  );

  return res.status(200).json({
    success: true,
    message: "Payment verified successfully",
    data: {
      purchaseId: purchase._id,
      movieId: purchase.movie,
      purchaseDate: purchase.paidAt,
      expiryDate: purchase.accessExpiresAt,
      amount: (purchase.amount || 0) / 100,
      status: purchase.status,
      watchLink: `/watch/${purchase.movie}`,
    },
  });
});

const getOrderStatus = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findOne({
    user: req.user.id,
    razorpayOrderId: req.params.orderId,
  }).lean();

  if (!purchase) {
    throw new ApiError(404, "Order not found");
  }

  return res.status(200).json({
    success: true,
    message: "Order status retrieved",
    data: {
      orderId: purchase.razorpayOrderId,
      paymentId: purchase.razorpayPaymentId,
      status: purchase.status,
      amount: (purchase.amount || 0) / 100,
      currency: purchase.currency,
      purchaseDate: purchase.paidAt,
      expiryDate: purchase.accessExpiresAt,
    },
  });
});

const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const body = req.rawBody || JSON.stringify(req.body);
  if (!signature || !env.razorpayWebhookSecret) {
    return res.status(400).json({ success: false, message: "Webhook secret or signature missing" });
  }

  const expected = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(body).digest("hex");
  if (expected !== signature) {
    return res.status(400).json({ success: false, message: "Invalid webhook signature" });
  }

  const event = req.body.event;
  const paymentEntity = req.body.payload?.payment?.entity;

  if (event === "payment.captured" && paymentEntity) {
    const orderId = paymentEntity.order_id;
    const paymentId = paymentEntity.id;

    const purchase = await Purchase.findOne({ razorpayOrderId: orderId });
    if (!purchase) {
      console.warn(`[Webhook] Purchase not found for order: ${orderId}`);
      return res.status(200).json({ success: true, message: "Purchase not found, but webhook acknowledged" });
    }

    if (purchase.status === "paid") {
      return res.status(200).json({ success: true, message: "Payment already processed" });
    }

    const movie = await Movie.findById(purchase.movie).select("_id validityDays totalPurchases totalRevenue");
    if (!movie) {
      console.error(`[Webhook] Movie not found for purchase: ${purchase._id}`);
      return res.status(200).json({ success: true, message: "Movie not found, webhook acknowledged" });
    }

    purchase.razorpayPaymentId = paymentId;
    purchase.status = "paid";
    purchase.paidAt = new Date();
    purchase.accessExpiresAt = calculateExpiryDate(new Date(), movie.validityDays || env.rentalDurationDays);
    await purchase.save();

    await Movie.updateOne(
      { _id: movie._id },
      {
        $inc: {
          totalPurchases: 1,
          totalRevenue: (purchase.amount || 0) / 100,
        },
      }
    );

    console.log(`[Webhook] Payment processed for order: ${orderId}`);
  }

  return res.status(200).json({ success: true, message: "Webhook processed" });
});

module.exports = { createOrder, verifyPayment, getOrderStatus, handleWebhook };
