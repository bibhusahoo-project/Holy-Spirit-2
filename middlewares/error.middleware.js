const ApiError = require("../utils/ApiError");

const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    console.error({
      route: req.originalUrl,
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let details;

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource identifier";
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    const validationErrors = Object.values(err.errors || {}).map((item) => item.message);
    message = validationErrors.join(", ");
    details = validationErrors;
  }

  if (err.code === 11000) {
    statusCode = 409;
    const duplicateField = Object.keys(err.keyValue || {})[0] || "resource";
    message = `${duplicateField} already exists`;
  }

  if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid or expired token";
  }

  if (err.type === "entity.too.large") {
    statusCode = 413;
    message = "Payload too large";
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 413;
    message = "Uploaded file is too large";
  }

  if (typeof message === "string" && message.startsWith("CORS policy:")) {
    statusCode = 403;
  }

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // log structured error for debugging (without secrets)
  console.error({
    route: req.originalUrl,
    method: req.method,
    statusCode,
    message,
    error: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    timestamp: new Date().toISOString(),
  });

  return res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
};

module.exports = { notFoundHandler, errorHandler };
