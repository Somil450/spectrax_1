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
    throw new Error(
      "[SpectraX] Socket.IO CORS_ORIGIN is set to '*' in production. " +
      "Set CORS_ORIGIN to your frontend domain (e.g., https://yourapp.com) to fix this.",
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
    maxHttpBufferSize: 100000,
  };
}

module.exports = {
  createSocketOptions,
};
