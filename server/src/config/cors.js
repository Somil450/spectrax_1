const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
];

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(",")
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

const corsOptions = {
  origin: (origin, callback) =>
    isOriginAllowed(origin)
      ? callback(null, true)
      : callback(new Error("Origin not allowed by CORS")),
  methods: ["GET", "POST"],
};

module.exports = {
  corsOptions,
  isOriginAllowed,
};
