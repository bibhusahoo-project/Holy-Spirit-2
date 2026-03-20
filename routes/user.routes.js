const express = require("express");
const {
  getMyMovies,
  getProfile, // NEW
  updateProfile,
  getTransactions,
} = require("../controllers/user.controller");
const { watchPurchasedMovie, streamPurchasedMovie } = require("../controllers/movie.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/role.middleware");
const { createRateLimiter } = require("../middlewares/security.middleware");
const { uploadAvatar } = require("../config/multer");
const { validatePaginationQuery } = require("../validators/pagination.validators");
const router = express.Router();

router.use(authenticate, authorize("user"));

const userRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20 });

router.get("/profile", userRateLimiter, getProfile); // NEW
router.get("/my-movies", getMyMovies);
router.get("/watch/:movieId", watchPurchasedMovie);
router.get("/watch/:movieId/stream", streamPurchasedMovie);

// Profile update (avatar optional)
router.put("/profile", uploadAvatar, updateProfile);
router.get("/transactions", validatePaginationQuery, getTransactions);

module.exports = router;
