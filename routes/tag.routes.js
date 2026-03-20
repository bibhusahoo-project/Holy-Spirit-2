const express = require("express");
const { createTag, listTags } = require("../controllers/tag.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/", listTags);
router.post("/", authenticate, authorize("admin"), createTag);

module.exports = router;
