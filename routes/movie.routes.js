const express = require("express");
const {
  listMovies,
  getMovieDetails,
  streamPurchasedMovie,
  watchPurchasedMovie,
  createMovie,
} = require("../controllers/movie.controller");
const { createOrder } = require("../controllers/payment.controller"); // NEW: For rent
const { uploadMovie, updateMovie } = require("../controllers/admin.controller");
const { authenticate, attachUserIfPresent } = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/role.middleware");
const { uploadMovieAssets } = require("../config/multer");
const { validatePaginationQuery } = require("../validators/pagination.validators");

const router = express.Router();

router.get("/", attachUserIfPresent, validatePaginationQuery, listMovies);
router.get("/:movieId", attachUserIfPresent, getMovieDetails);

// NEW: Rent movie endpoint
router.post("/:movieId/rent", authenticate, authorize("user"), createOrder);

router.post(
  "/create",
  authenticate,
  authorize("admin"),
  createMovie
);

router.post(
  "/upload",
  authenticate,
  authorize("admin"),
  uploadMovieAssets,
  uploadMovie
);


module.exports = router;
