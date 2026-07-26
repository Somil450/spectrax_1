const { resolveSessionPath } = require("../shared/utils/paths");

function safeParseInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function getConfig(overrides = {}) {
  const port = overrides.port ?? (process.env.PORT ? process.env.PORT : 3001);
  const corsOrigin = overrides.corsOrigin ?? process.env.CORS_ORIGIN ?? (
    process.env.NODE_ENV === "production"
      ? (() => { throw new Error("CORS_ORIGIN must be set in production"); })()
      : "*"
  );
  const sessionPath =
    overrides.sessionPath ?? process.env.SESSION_PATH ?? resolveSessionPath();
  const maxSessionFrames =
    overrides.maxSessionFrames ?? safeParseInt(process.env.MAX_SESSION_FRAMES, 300);
  const socketPath =
    overrides.socketPath ?? process.env.SOCKET_PATH ?? "/socket.io";
  const maxConnectionsPerIp =
    overrides.maxConnectionsPerIp ?? safeParseInt(process.env.MAX_CONNECTIONS_PER_IP, 10);
  const trustProxy =
    overrides.trustProxy ?? (Number(process.env.TRUST_PROXY) || 0);

  return {
    port,
    corsOrigin,
    sessionPath,
    maxSessionFrames,
    socketPath,
    maxConnectionsPerIp,
    trustProxy,
  };
}

module.exports = {
  getConfig,
};
