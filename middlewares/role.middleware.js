const ApiError = require("../utils/ApiError");

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Unauthorized"));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, "Forbidden"));
  }

  return next();
};

module.exports = { authorize };
