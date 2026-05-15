const fs = require("fs");

function createSessionService({
  sessionStore,
  sessionPath,
  maxSessionFrames,
  logger,
}) {
  function appendFrame(socketId, frame) {
    const sessionFrames = sessionStore.getSessionFrames(socketId);

    if (sessionFrames.length >= maxSessionFrames) {
      sessionFrames.shift();
    }

    sessionFrames.push(frame);
    sessionStore.setSessionFrames(socketId, sessionFrames);
  }

  function saveSession(frames, socketId) {
    try {
      const sessionData = {
        savedAt: new Date().toISOString(),
        socketId,
        frameCount: frames.length,
        frames,
      };

      fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
      logger.info(`[SpectraX] session.json saved (${frames.length} frames)`);
    } catch (error) {
      logger.error("[SpectraX] Failed to save session:", error.message);
    }
  }

  function finalizeSession(socketId) {
    const frames = sessionStore.getSessionFrames(socketId);

    if (frames.length > 0) {
      saveSession(frames, socketId);
    }

    sessionStore.deleteSession(socketId);
    return frames;
  }

  function saveAllSessions() {
    for (const [socketId, frames] of sessionStore.entries()) {
      if (frames.length > 0) {
        saveSession(frames, socketId);
      }
    }
  }

  return {
    appendFrame,
    finalizeSession,
    saveAllSessions,
    saveSession,
  };
}

module.exports = {
  createSessionService,
};
