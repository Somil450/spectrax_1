const fs = require("fs");
const path = require("path");
const { SESSIONS_DIR, MAX_SESSION_FRAMES } = require("../config/constants");

function saveSession(frames, socketId) {
  try {
    // Ensure sessions directory exists
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }

    const sessionData = {
      savedAt: new Date().toISOString(),
      socketId,
      frameCount: frames.length,
      frames,
    };
    const safeId = socketId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `session-${safeId}-${Date.now()}.json`;
    const filePath = path.join(SESSIONS_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
    console.log(
      `[SpectraX] Session saved: ${filename} (${frames.length} frames)`,
    );
  } catch (err) {
    console.error("[SpectraX] Failed to save session:", err.message);
  }
}

module.exports = {
  saveSession,
  MAX_SESSION_FRAMES,
};
