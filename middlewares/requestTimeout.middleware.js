const ApiError = require("../utils/ApiError");

const requestTimeout = (timeoutMs) => (req, res, next) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return next();
  }

  res.setTimeout(timeoutMs, () => {
    if (!res.headersSent) {
      next(new ApiError(503, "Request timed out"));
    }
  });

  return next();
};

module.exports = { requestTimeout };
