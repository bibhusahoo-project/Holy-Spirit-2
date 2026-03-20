const crypto = require("crypto");
const bcrypt = require("bcryptjs"); // NEW: For password hashing
const User = require("../models/user.model");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { signToken } = require("../utils/jwt");
const env = require("../config/env");

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const DEMO_USER_ID = "000000000000000000000002";

const getEnvAdmin = () => ({
  id: "admin",
  name: String(env.adminName || "Admin").trim(),
  email: String(env.adminEmail || "").trim().toLowerCase(),
  role: "admin",
});

const getDemoAdmin = () => ({
  id: "demo-admin",
  name: String(env.demoAdminName || "Demo Admin").trim(),
  email: String(env.demoAdminEmail || "admin@demo.com").trim().toLowerCase(),
  role: "admin",
});

const getDemoUser = () => ({
  id: DEMO_USER_ID,
  mobile: normalizeMobile(env.demoUserMobile),
  name: String(env.demoUserName || "Demo User").trim(),
  email: env.demoUserEmail ? String(env.demoUserEmail).trim().toLowerCase() : null,
  role: "user",
  blocked: false,
});

const sanitizeUser = (user) => ({
  id: String(user._id || user.id),
  mobile: user.mobile || null,
  name: user.name || "",
  email: user.email || null,
  role: user.role,
  blocked: Boolean(user.blocked),
});

const sendAuthSuccess = (res, account, message = "Authentication successful") => {
  const token = signToken({
    id: String(account._id || account.id),
    role: account.role,
    name: account.name || "User",
    mobile: account.mobile || null,
  });

  return res.status(200).json({
    success: true,
    message,
    user: account.role === "admin" ? account : sanitizeUser(account),
    token,
    data: {
      user: account.role === "admin" ? account : sanitizeUser(account),
      token,
    },
  });
};

const normalizeMobile = (mobile) => {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (!MOBILE_REGEX.test(digits)) {
    throw new ApiError(400, "mobile must be a valid 10 digit Indian number");
  }
  return digits;
};

const normalizeEmail = (email) => {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    throw new ApiError(400, "invalid email format");
  }
  return normalized;
};

const hashOtp = (mobile, otp) =>
  crypto.createHash("sha256").update(`${mobile}:${otp}:${env.jwtSecret}`).digest("hex");

const createOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const sendOtp = asyncHandler(async (req, res) => {
  logAuthRequest("send-otp", { mobile: req.body.mobile || null });
  const mobile = normalizeMobile(req.body.mobile);
  const name = req.body.name ? String(req.body.name).trim() : "";
  const email = normalizeEmail(req.body.email);

  const otpCode = createOtpCode();
  const otp = {
    codeHash: hashOtp(mobile, otpCode),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    attempts: 0,
    sentAt: new Date(),
  };

  const user = await User.findOneAndUpdate(
    { mobile },
    {
      $set: {
        mobile,
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        otp,
      },
      $setOnInsert: {
        role: "user",
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return res.status(200).json({
    success: true,
    message: "OTP sent successfully",
    data: {
      mobile,
      expiresInSeconds: OTP_TTL_MS / 1000,
      ...(env.nodeEnv !== "production" ? { otp } : {}),
      ...(env.nodeEnv !== "production" ? { otpCode } : {}),
      userExists: Boolean(user?.lastLoginAt),
    },
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  logAuthRequest("verify-otp", { mobile: req.body.mobile || null });
  const mobile = normalizeMobile(req.body.mobile);
  const otpCode = String(req.body.otp || "").trim();

  if (!/^\d{6}$/.test(otpCode)) {
    throw new ApiError(400, "otp must be a 6 digit code");
  }

  const user = await User.findOne({ mobile }).select("+otp.codeHash +otp.expiresAt +otp.attempts +otp.sentAt");
  if (!user) {
    throw new ApiError(404, "User not found for this mobile number");
  }
  if (user.blocked) {
    throw new ApiError(403, "This account is blocked");
  }
  if (!user.otp?.codeHash || !user.otp?.expiresAt) {
    throw new ApiError(400, "OTP not requested");
  }
  if (user.otp.expiresAt <= new Date()) {
    throw new ApiError(400, "OTP expired");
  }
  if ((user.otp.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    throw new ApiError(429, "Too many OTP attempts. Please request a new code.");
  }

  const expectedHash = hashOtp(mobile, otpCode);
  if (expectedHash !== user.otp.codeHash) {
    user.otp.attempts = (user.otp.attempts || 0) + 1;
    await user.save();
    throw new ApiError(400, "Invalid OTP");
  }

  user.otp = {
    codeHash: null,
    expiresAt: null,
    attempts: 0,
    sentAt: null,
  };
  user.lastLoginAt = new Date();
  if (!user.name) {
    user.name = `User ${mobile.slice(-4)}`;
  }
  if (!user.phone) {
    user.phone = mobile;
  }
  await user.save();

  return sendAuthSuccess(res, user, "OTP verified successfully");
});

const adminLogin = asyncHandler(async (req, res) => {
  logAuthRequest("admin-login", { email: req.body.email || null });
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const envAdmin = getEnvAdmin();

  if (!email || !password) {
    throw new ApiError(400, "email and password are required");
  }

  if (email !== envAdmin.email || password !== String(env.adminPassword || "")) {
    throw new ApiError(401, "Invalid credentials");
  }

  return sendAuthSuccess(res, envAdmin, "Admin login successful");
});

const ensureDemoLoginEnabled = () => {
  if (!env.enableDemoLogin) {
    throw new ApiError(404, "Demo login is disabled");
  }
};

const logAuthRequest = (label, payload = {}) => {
  console.log("[Auth] Auth Request Received", {
    label,
    ...payload,
    timestamp: new Date().toISOString(),
  });
};

const demoAdminLogin = asyncHandler(async (_req, res) => {
  ensureDemoLoginEnabled();
  console.log("Demo login request received", { role: "admin" });
  logAuthRequest("demo-admin-login", { role: "admin" });
  return sendAuthSuccess(res, getDemoAdmin(), "Demo admin login successful");
});

const demoUserLogin = asyncHandler(async (_req, res) => {
  ensureDemoLoginEnabled();
  console.log("Demo login request received", { role: "user" });
  logAuthRequest("demo-user-login", { role: "user" });
  return sendAuthSuccess(res, getDemoUser(), "Demo user login successful");
});

const demoLogin = asyncHandler(async (req, res) => {
  ensureDemoLoginEnabled();

  const role = String(req.body?.role || "").trim().toLowerCase();
  console.log("Demo login request received", { role });
  logAuthRequest("demo-login", { role });

  if (role === "admin") {
    return sendAuthSuccess(res, getDemoAdmin(), "Demo admin login successful");
  }

  if (role === "user") {
    return sendAuthSuccess(res, getDemoUser(), "Demo user login successful");
  }

  throw new ApiError(400, "role must be either admin or user");
});

const getMe = asyncHandler(async (req, res) => {
  if (req.user.role === "admin") {
    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: getEnvAdmin(),
    });
  }

  if (env.enableDemoLogin && String(req.user.id) === DEMO_USER_ID) {
    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: getDemoUser(),
    });
  }

  const user = await User.findById(req.user.id).lean();
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    data: sanitizeUser(user),
  });
});

// NEW: Email/password registration
const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    throw new ApiError(400, "email, password, and name are required");
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, "Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({
    email: normalizedEmail,
    password: hashedPassword,
    name: String(name).trim(),
    role: "user",
  });

  return sendAuthSuccess(res, user, "Registration successful");
});

// NEW: Email/password login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "email and password are required");
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail }).select("+password");
  if (!user || !user.password) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (user.blocked) {
    throw new ApiError(403, "Account is blocked");
  }

  user.lastLoginAt = new Date();
  await user.save();

  return sendAuthSuccess(res, user, "Login successful");
});

module.exports = {
  sendOtp,
  verifyOtp,
  adminLogin,
  register, // NEW
  login, // NEW
  demoLogin,
  demoAdminLogin,
  demoUserLogin,
  getMe,
};
