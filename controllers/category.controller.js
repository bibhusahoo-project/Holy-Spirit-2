const Category = require("../models/category.model");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { cache } = require("../services/cache.service");

const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, "Category name is required");
  }

  const trimmed = name.trim();
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const existing = await Category.findOne({ $or: [{ name: trimmed }, { slug }] });
  if (existing) {
    // Return existing category instead of throwing — makes creation idempotent
    return res.status(200).json({ success: true, message: "Category already exists", data: existing });
  }

  const category = await Category.create({ name: trimmed, slug });
  cache.clearPrefix("categories:list");
  return res.status(201).json({ success: true, message: "Category created", data: category });
});

const listCategories = asyncHandler(async (req, res) => {
  const cached = cache.get("categories:list");
  if (cached) {
    return res.status(200).json(cached);
  }

  const categories = await Category.find().select("-__v").sort({ name: 1 }).lean();
  const responsePayload = { success: true, message: "Categories fetched", data: categories };
  cache.set("categories:list", responsePayload, 60 * 1000);
  return res.status(200).json(responsePayload);
});

module.exports = { createCategory, listCategories };
