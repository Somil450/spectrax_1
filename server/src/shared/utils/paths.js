const fs = require("fs");
const path = require("path");

const SERVER_ROOT = path.resolve(__dirname, "..", "..", "..");
const SESSIONS_DIR = path.join(SERVER_ROOT, "sessions");

function resolveSessionPath(fileName = "session.json") {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
  return path.join(SESSIONS_DIR, fileName);
}

function buildSessionFilePath(sessionPath, socketId) {
  const parsed = path.parse(sessionPath);
  const safeSocketId = String(socketId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const extension = parsed.ext || ".json";

  return path.join(parsed.dir, `${parsed.name}-${safeSocketId}${extension}`);
}

module.exports = {
  SERVER_ROOT,
  resolveSessionPath,
  buildSessionFilePath,
};
