const User = require("../models/user.model");
const ApiError = require("../utils/ApiError");
const { verifyToken } = require("../utils/jwt");
const env = require("../config/env");
const DEMO_USER_ID = "000000000000000000000002";

const isJwtError = (error) => error && (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new ApiError(401, "Authorization token is missing"));
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = verifyToken(token);
    } catch (error) {
      if (isJwtError(error)) {
        return next(new ApiError(401, "Invalid or expired token"));
      }
      return next(error);
    }

    if (decoded.role === "admin") {
      req.user = {
        id: "admin",
        email: String(env.adminEmail || "").trim().toLowerCase(),
        role: "admin",
        name: String(decoded.name || env.adminName || "Admin").trim(),
      };

      return next();
    }

    if (decoded.role !== "user") {
      return next(new ApiError(401, "Invalid or expired token"));
    }

    if (env.enableDemoLogin && String(decoded.id) === DEMO_USER_ID) {
      req.user = {
        id: DEMO_USER_ID,
        email: env.demoUserEmail || null,
        mobile: String(env.demoUserMobile || "").trim() || null,
        role: "user",
        name: String(decoded.name || env.demoUserName || "Demo User").trim(),
      };

      return next();
    }

    const user = await User.findById(decoded.id)
      .select("_id name email mobile role isActive blocked")
      .lean()
      .exec();
    if (!user || !user.isActive || user.blocked) {
      return next(new ApiError(401, "User not found or inactive"));
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      name: user.name,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

const attachUserIfPresent = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  return authenticate(req, _res, next);
};

module.exports = { authenticate, attachUserIfPresent };
