const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    const log = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      timestamp: new Date().toISOString(),
    };

    if (res.statusCode >= 500) {
      console.error("[HTTP]", log);
    } else {
      console.log("[HTTP]", log);
    }
  });

  next();
};

module.exports = { requestLogger };
