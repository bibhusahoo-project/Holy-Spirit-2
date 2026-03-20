const path = require("path");
const dotenv = require("dotenv");

// Always resolve backend/.env regardless of where the process is started.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3002",
  "http://127.0.0.1:3002",
];

const requiredKeys = [
  "JWT_SECRET",
];

// In development, allow using an in-memory MongoDB instance when a real Mongo URI is not available.
const useInMemoryDb = process.env.USE_IN_MEMORY_DB === "true";

const missing = requiredKeys.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

if (!process.env.MONGO_URI && !useInMemoryDb) {
  throw new Error(
    "Missing required environment variable MONGO_URI. Set it in .env or enable in-memory DB with USE_IN_MEMORY_DB=true."
  );
}

if ((process.env.NODE_ENV || "development") !== "production") {
  // log masked razorpay key ID for local debugging only
  const maskKey = (str = "") => str.replace(/.(?=.{4})/g, "*");
  console.log("[Env] Razorpay Key ID:", maskKey(process.env.RAZORPAY_KEY_ID || ""));
  console.log("[Env] Allowed Origins:", process.env.ALLOWED_ORIGINS || "<not set>");
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number.parseInt(process.env.PORT, 10) || 5000,
  trustProxy: process.env.TRUST_PROXY === "true",
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  jsonLimit: process.env.JSON_LIMIT || "1mb",
  requestTimeoutMs: Math.max(5000, Number(process.env.REQUEST_TIMEOUT_MS) || 30000),
  keepAliveTimeoutMs: Math.max(1000, Number(process.env.KEEP_ALIVE_TIMEOUT_MS) || 5000),
  headersTimeoutMs: Math.max(2000, Number(process.env.HEADERS_TIMEOUT_MS) || 60000),
  rateLimitWindowMs: Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000),
  rateLimitMax: Math.max(10, Number(process.env.RATE_LIMIT_MAX) || 120),
  rentalDurationDays: Math.max(1, Number(process.env.RENTAL_DURATION_DAYS) || 30),
  uploadChunkSizeMb: Math.max(10, Number(process.env.UPLOAD_CHUNK_SIZE_MB) || 100),
  otpTtlSeconds: Math.max(60, Number(process.env.OTP_TTL_SECONDS) || 300),
  enableDemoLogin: process.env.ENABLE_DEMO_LOGIN === "true",
  demoAdminEmail: (process.env.DEMO_ADMIN_EMAIL || "admin@demo.com").trim().toLowerCase(),
  demoAdminPassword: process.env.DEMO_ADMIN_PASSWORD || "admin123",
  demoAdminName: process.env.DEMO_ADMIN_NAME || "Demo Admin",
  demoUserMobile: String(process.env.DEMO_USER_MOBILE || "9999999999").trim(),
  demoUserName: process.env.DEMO_USER_NAME || "Demo User",
  demoUserEmail: process.env.DEMO_USER_EMAIL ? process.env.DEMO_USER_EMAIL.trim().toLowerCase() : "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  allowedOrigins: (process.env.ALLOWED_ORIGINS || defaultAllowedOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  adminEmail: process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  adminName: process.env.ADMIN_NAME || "System Admin",
  maxUploadSizeMb: Math.max(10, Number(process.env.MAX_UPLOAD_SIZE_MB) || 2000),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5000",
  useInMemoryDb,
};
