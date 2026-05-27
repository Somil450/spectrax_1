const path = require("path");

module.exports = {
  PORT: 3001,
  SESSIONS_DIR: path.join(__dirname, "../../sessions"),
  MAX_FRAMES_PER_SEC: Number(process.env.MAX_FRAMES_PER_SEC) || 60,
  MAX_SESSION_FRAMES: 300, // Rolling buffer
  SOCKET_AUTH_TOKEN: process.env.SOCKET_AUTH_TOKEN || "",
  MAX_CONNECTIONS_PER_IP: Number(process.env.MAX_CONNECTIONS_PER_IP) || 10,
  PAYLOAD_LIMIT: "100kb",
};
