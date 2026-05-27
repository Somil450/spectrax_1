function parseOrigin(raw) {
  if (!raw || raw === "*") return "*";
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function createCorsOptions(config) {
  const origin = parseOrigin(config.corsOrigin);

  if (origin === "*" && process.env.NODE_ENV === "production") {
    console.warn(
      "[SpectraX] WARNING: CORS origin is set to '*' in production. Restrict it via CORS_ORIGIN env.",
    );
  }

  return { origin };
}

module.exports = {
  createCorsOptions,
};
