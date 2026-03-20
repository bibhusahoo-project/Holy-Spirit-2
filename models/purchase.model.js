const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    movie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    razorpayOrderId: {
      type: String,
      required: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "expired"],
      default: "pending",
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    accessExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

purchaseSchema.index({ user: 1, movie: 1, status: 1, accessExpiresAt: 1 });
purchaseSchema.index({ user: 1, createdAt: -1 });
purchaseSchema.index({ status: 1, createdAt: -1 });
purchaseSchema.index({ movie: 1, paidAt: -1 });
purchaseSchema.index({ accessExpiresAt: 1, status: 1 });
purchaseSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });
purchaseSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });
purchaseSchema.index({ movie: 1, status: 1 });
purchaseSchema.index({ user: 1, status: 1 });
purchaseSchema.index({ paidAt: 1 });

module.exports = mongoose.model("Purchase", purchaseSchema);
