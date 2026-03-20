const express = require("express");
const {
  createOrder,
  verifyPayment,
  getOrderStatus,
  handleWebhook,
} = require("../controllers/payment.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { authorize } = require("../middlewares/role.middleware");
const { createRateLimiter } = require("../middlewares/security.middleware");
const { validateCreateOrderBody, validateVerifyPaymentBody } = require("../validators/payment.validators");

const router = express.Router();

// webhook endpoint does not require authentication
router.post("/webhook", handleWebhook);

// all other payment APIs are user-protected
router.use(authenticate, authorize("user"));

const paymentRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10 });

router.post("/create-order", paymentRateLimiter, validateCreateOrderBody, createOrder);
router.post("/verify", paymentRateLimiter, validateVerifyPaymentBody, verifyPayment);
router.get("/order/:orderId", paymentRateLimiter, getOrderStatus);

module.exports = router;
