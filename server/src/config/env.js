const { resolveSessionPath } = require("../shared/utils/paths");
require("dotenv").config();

function getConfig(overrides = {}) {
  const port = overrides.port ?? Number(process.env.PORT || 3001);
  const corsOrigin = overrides.corsOrigin ?? process.env.CORS_ORIGIN ?? "*";
  const sessionPath =
    overrides.sessionPath ?? process.env.SESSION_PATH ?? resolveSessionPath();
  const maxSessionFrames =
    overrides.maxSessionFrames ?? Number(process.env.MAX_SESSION_FRAMES || 300);
  const socketPath =
    overrides.socketPath ?? process.env.SOCKET_PATH ?? "/socket.io";

  return {
    port,
    corsOrigin,
    sessionPath,
    maxSessionFrames,
    socketPath,
  };
}

module.exports = {
  getConfig,
};
