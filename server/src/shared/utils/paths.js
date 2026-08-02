const fs = require("fs");
const path = require("path");

const SERVER_ROOT = path.resolve(__dirname, "..", "..", "..");

function resolveSessionPath(fileName = "session.json") {
  return path.join(SERVER_ROOT, "sessions", fileName);
}

function buildSessionFilePath(sessionPath, socketId) {
  const parsed = path.parse(sessionPath);
  const safeSocketId = String(socketId).replace(/[^a-zA-Z0-9_-]/g, "_");
  const extension = parsed.ext || ".json";

  // Ensure the target directory exists so session files land in a dedicated
  // `sessions/` folder instead of the server root (see #582, gap 3).
  if (parsed.dir) {
    fs.mkdirSync(parsed.dir, { recursive: true });
  }

  // Timestamped filenames accumulate historical snapshots instead of
  // overwriting the previous file for the same socket id.
  return path.join(
    parsed.dir,
    `${parsed.name}-${safeSocketId}-${Date.now()}${extension}`,
  );
}

module.exports = {
  SERVER_ROOT,
  resolveSessionPath,
  buildSessionFilePath,
};
