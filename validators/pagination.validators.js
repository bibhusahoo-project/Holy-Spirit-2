const ApiError = require("../utils/ApiError");

const validatePaginationQuery = (req, res, next) => {
  const { page, limit } = req.query || {};

  if (typeof page !== "undefined") {
    const parsedPage = Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return next(new ApiError(400, "page must be a positive integer"));
    }
  }

  if (typeof limit !== "undefined") {
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return next(new ApiError(400, "limit must be an integer between 1 and 50"));
    }
  }

  return next();
};

module.exports = { validatePaginationQuery };
