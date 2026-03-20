const ApiError = require("../utils/ApiError");

const validateSendOtpBody = (req, res, next) => {
  const { mobile } = req.body || {};
  if (!mobile) {
    return next(new ApiError(400, "mobile is required"));
  }
  return next();
};

const validateVerifyOtpBody = (req, res, next) => {
  const { mobile, otp } = req.body || {};
  if (!mobile || !otp) {
    return next(new ApiError(400, "mobile and otp are required"));
  }
  return next();
};

const validateAdminLoginBody = (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return next(new ApiError(400, "email and password are required"));
  }
  return next();
};

// NEW: Validators for email/password auth
const validateRegisterBody = (req, res, next) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return next(new ApiError(400, "email, password, and name are required"));
  }
  if (password.length < 6) {
    return next(new ApiError(400, "password must be at least 6 characters"));
  }
  return next();
};

const validateLoginBody = (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return next(new ApiError(400, "email and password are required"));
  }
  return next();
};

module.exports = {
  validateSendOtpBody,
  validateVerifyOtpBody,
  validateAdminLoginBody,
  validateRegisterBody, // NEW
  validateLoginBody, // NEW
};
