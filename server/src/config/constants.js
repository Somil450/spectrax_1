const path = require("path");

module.exports = {
  PORT: Number(process.env.PORT) || 3001,
  SESSIONS_DIR: process.env.SESSIONS_DIR || path.join(__dirname, "../../sessions"),
  MAX_FRAMES_PER_SEC: Number(process.env.MAX_FRAMES_PER_SEC) || (process.env.MAX_FRAMES_PER_SEC === "0" ? 0 : 60),
  MAX_SESSION_FRAMES: Number(process.env.MAX_SESSION_FRAMES) || 300,
  SOCKET_AUTH_TOKEN: process.env.SOCKET_AUTH_TOKEN ?? null,
  MAX_CONNECTIONS_PER_IP: Number(process.env.MAX_CONNECTIONS_PER_IP) || 10,
  PAYLOAD_LIMIT: process.env.PAYLOAD_LIMIT || "100kb",
};
