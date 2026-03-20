const express = require("express");
const {
  sendOtp,
  verifyOtp,
  adminLogin,
  register, // NEW
  login, // NEW
  demoLogin,
  demoAdminLogin,
  demoUserLogin,
  getMe,
} = require("../controllers/auth.controller");
const { createRateLimiter } = require("../middlewares/security.middleware");
const { authenticate } = require("../middlewares/auth.middleware");
const {
  validateSendOtpBody,
  validateVerifyOtpBody,
  validateAdminLoginBody,
  validateRegisterBody, // NEW
  validateLoginBody, // NEW
} = require("../validators/auth.validators");

const router = express.Router();

const authRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 8 });

router.post("/otp/send", authRateLimiter, validateSendOtpBody, sendOtp);
router.post("/otp/verify", authRateLimiter, validateVerifyOtpBody, verifyOtp);
router.post("/admin/login", authRateLimiter, validateAdminLoginBody, adminLogin);
router.post("/register", authRateLimiter, validateRegisterBody, register); // NEW
router.post("/login", authRateLimiter, validateLoginBody, login); // NEW
router.post("/demo-login", demoLogin);
router.post("/demo/admin", demoAdminLogin);
router.post("/demo/user", demoUserLogin);
router.get("/me", authenticate, getMe);

module.exports = router;
