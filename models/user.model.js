const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    codeHash: {
      type: String,
      default: null,
      select: false,
    },
    expiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    attempts: {
      type: Number,
      default: 0,
      select: false,
    },
    sentAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      default: null,
    },
    password: { // NEW: For email/password auth
      type: String,
      default: null,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
      index: true,
    },
    blocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    username: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    bio: {
      type: String,
      trim: true,
      default: "",
    },
    avatar: {
      type: String,
      default: null,
    },
    otp: {
      type: otpSchema,
      default: () => ({}),
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1, blocked: 1, isActive: 1 });

module.exports = mongoose.model("User", userSchema);
