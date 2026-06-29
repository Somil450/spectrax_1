function errorHandler(err, req, res, next) {
  const message = process.env.NODE_ENV === "production" ? err.message : err.stack;
  console.error("[SpectraX] Unhandled Error:", message);
  res.status(500).json({ error: "Internal Server Error" });
}

module.exports = errorHandler;
