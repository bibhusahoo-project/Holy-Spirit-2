const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    secureUrl: { type: String, default: null, trim: true },
    publicId: { type: String, required: true, trim: true, index: true },
    resourceType: { type: String, enum: ["image", "video"], required: true },
  },
  { _id: false }
);

const movieChunkSchema = new mongoose.Schema(
  {
    part: {
      type: Number,
      required: true,
      min: 1,
    },
    chunkIndex: {
      type: Number,
      default: null,
      min: 0,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationSeconds: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  { _id: false }
);

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    language: {
      type: String,
      default: "Hindi",
      trim: true,
      index: true,
    },
    validityDays: {
      type: Number,
      default: 30,
      min: 1,
    },
    status: {
      type: String,
      enum: ["Active", "inactive"],
      default: "Active",
      index: true,
    },
    genres: {
      type: [String],
      default: [],
      index: true,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    actors: [{ type: String, trim: true }],
    rating: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
    totalViews: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPurchases: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    poster: {
      type: mediaSchema,
      required: false, // Temporarily make this not required
    },
    coverImage: {
      type: mediaSchema,
      required: false, // Temporarily make this not required
    },
    videos: [
      {
        partNumber: { type: Number, required: true },
        url: { type: String, required: true },
        public_id: { type: String, required: true },
        duration: {
          type: Number,
          default: 0,
          min: 0
        }
      },
    ],
    videoUrl: {
      type: String,
      default: null,
      trim: true,
    },
    totalChunks: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: false, // Temporarily make this not required for debugging
    },
  },
  {
    timestamps: true,
  }
);

movieSchema.index({ createdAt: -1 });
movieSchema.index({ status: 1, createdAt: -1 });
movieSchema.index({ totalRevenue: -1, totalViews: -1 });
movieSchema.index({ status: 1, language: 1, createdAt: -1 });
movieSchema.index({ price: 1 });
movieSchema.index({ rating: -1 });
movieSchema.index({ categories: 1 });

module.exports = mongoose.model("Movie", movieSchema);
