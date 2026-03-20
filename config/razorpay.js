const Razorpay = require("razorpay");
const env = require("./env");

let razorpayClient = null;

try {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    console.warn("[Razorpay] key_id or key_secret is missing. Payment features will be disabled.");
  } else {
    razorpayClient = new Razorpay({
      key_id: env.razorpayKeyId,
      key_secret: env.razorpayKeySecret,
    });
    const masked = env.razorpayKeyId.replace(/.(?=.{4})/g, "*");
    console.log(`[Razorpay] initialized with key id ${masked}`);
  }
} catch (err) {
  console.error("[Razorpay] initialization failed:", err.message || err);
  console.warn("[Razorpay] Payment features will be disabled.");
  razorpayClient = null;
}

module.exports = razorpayClient;
