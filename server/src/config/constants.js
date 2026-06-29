const path = require("path");

module.exports = {
  PORT: 3001,
  SESSIONS_DIR: path.join(__dirname, "../../sessions"),
  MAX_FRAMES_PER_SEC: (() => { const n = Number(process.env.MAX_FRAMES_PER_SEC); return isNaN(n) || n <= 0 ? 60 : n; })(),
  MAX_SESSION_FRAMES: 300, // Rolling buffer
  SOCKET_AUTH_TOKEN: process.env.SOCKET_AUTH_TOKEN ?? null,
  MAX_CONNECTIONS_PER_IP: Number(process.env.MAX_CONNECTIONS_PER_IP) || 10,
  PAYLOAD_LIMIT: "100kb",
};
