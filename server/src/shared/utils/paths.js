const path = require("path");

const SERVER_ROOT = path.resolve(__dirname, "..", "..", "..");

function resolveSessionPath(fileName = "session.json") {
  return path.join(SERVER_ROOT, fileName);
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
