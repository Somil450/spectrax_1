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
    throw new Error(
      "[SpectraX] CORS_ORIGIN is set to '*' in production. " +
      "Set CORS_ORIGIN to your frontend domain (e.g., https://yourapp.com) to fix this.",
    );
  }

  return { origin };
}

module.exports = {
  createCorsOptions,
};
