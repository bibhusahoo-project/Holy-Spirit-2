const express = require("express");
const { createCategory, listCategories } = require("../controllers/category.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/", listCategories);
router.post("/", authenticate, authorize("admin"), createCategory);

module.exports = router;
