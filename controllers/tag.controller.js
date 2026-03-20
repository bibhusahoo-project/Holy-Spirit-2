const Tag = require("../models/tag.model");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { cache } = require("../services/cache.service");

const createTag = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    throw new ApiError(400, "Tag name is required");
  }

  const existing = await Tag.findOne({ name: name.trim() });
  if (existing) {
    throw new ApiError(409, "Tag already exists");
  }

  const tag = await Tag.create({ name: name.trim() });
  cache.clearPrefix("tags:list");
  return res.status(201).json({ success: true, message: "Tag created", data: tag });
});

const listTags = asyncHandler(async (req, res) => {
  const cached = cache.get("tags:list");
  if (cached) {
    return res.status(200).json(cached);
  }

  const tags = await Tag.find().select("-__v").sort({ name: 1 }).lean();
  const responsePayload = { success: true, message: "Tags fetched", data: tags };
  cache.set("tags:list", responsePayload, 60 * 1000);
  return res.status(200).json(responsePayload);
});

module.exports = { createTag, listTags };
