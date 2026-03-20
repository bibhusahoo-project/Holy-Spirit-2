const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/role.middleware");
const { uploadChunkMiddleware } = require("../middlewares/upload.middleware");
const { uploadMovieChunk } = require("../controllers/movie.controller");

const router = express.Router();

router.post("/upload-chunk", authenticate, authorize("admin"), uploadChunkMiddleware, uploadMovieChunk);

module.exports = router;
