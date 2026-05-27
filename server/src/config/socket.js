function parseOrigin(raw) {
  if (!raw || raw === "*") return "*";
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function createSocketOptions(config) {
  const origin = parseOrigin(config.corsOrigin);

  if (origin === "*" && process.env.NODE_ENV === "production") {
    console.warn(
      "[SpectraX] WARNING: Socket.IO CORS origin is set to '*' in production. Restrict it via CORS_ORIGIN env.",
    );
  }

  return {
    cors: {
      origin,
      methods: ["GET", "POST"],
    },
    pingInterval: 5000,
    pingTimeout: 3000,
    transports: ["websocket"],
    path: config.socketPath,
  };
}

module.exports = {
  createSocketOptions,
};
