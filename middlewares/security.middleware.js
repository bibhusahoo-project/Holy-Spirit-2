const stripDangerousKeys = (value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = stripDangerousKeys(value[i]);
    }
    return value;
  }

  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete value[key];
      continue;
    }
    value[key] = stripDangerousKeys(value[key]);
  }

  return value;
};

const mongoSanitize = (req, res, next) => {
  stripDangerousKeys(req.body);
  stripDangerousKeys(req.query);
  stripDangerousKeys(req.params);
  next();
};

const stripTags = (input) =>
  String(input).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<\/?[^>]+(>|$)/g, "");

const scrubStringValues = (value) => {
  if (typeof value === "string") {
    return stripTags(value);
  }

  if (Array.isArray(value)) {
    return value.map(scrubStringValues);
  }

  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      value[key] = scrubStringValues(value[key]);
    }
  }

  return value;
};

const xssClean = (req, res, next) => {
  req.body = scrubStringValues(req.body);
  req.query = scrubStringValues(req.query);
  req.params = scrubStringValues(req.params);
  next();
};

const applySecurityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-XSS-Protection", "0");
  next();
};

const createRateLimiter = ({ windowMs = 60 * 1000, max = 120 } = {}) => {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size > 5000) {
      for (const [bucketKey, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }
    const key = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const existing = buckets.get(key);

    if (!existing || now > existing.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= max) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(Math.max(1, retryAfter)));
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
      });
    }

    existing.count += 1;
    return next();
  };
};

module.exports = {
  mongoSanitize,
  xssClean,
  applySecurityHeaders,
  createRateLimiter,
};
