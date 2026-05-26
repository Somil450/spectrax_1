const fs = require('fs');
const { buildSessionFilePath } = require('../../shared/utils/paths');

const finalizedSessions = new Set();

function createSessionService({ sessionStore, sessionPath, maxSessionFrames, logger }) {
  function appendFrame(socketId, frame) {
    const sessionFrames = sessionStore.getSessionFrames(socketId);

    if (sessionFrames.length >= maxSessionFrames) {
      sessionFrames.shift();
    }

    sessionFrames.push(frame);
    sessionStore.setSessionFrames(socketId, sessionFrames);
  }

  async function saveSession(frames, socketId) {
    try {
      const resolvedSessionPath = buildSessionFilePath(sessionPath, socketId);
      const sessionData = {
        savedAt: new Date().toISOString(),
        socketId,
        frameCount: frames.length,
        frames,
      };

      await fs.promises.writeFile(resolvedSessionPath, JSON.stringify(sessionData, null, 2));
      logger.info(`[SpectraX] session.json saved (${frames.length} frames)`);
      return resolvedSessionPath;
    } catch (error) {
      logger.error('[SpectraX] Failed to save session:', error.message);
      return null;
    }
  }


async function finalizeSession(socketId) {
  if (finalizedSessions.has(socketId)) return [];

  finalizedSessions.add(socketId);

  try {
    const frames = sessionStore.getSessionFrames(socketId);

    if (frames && frames.length > 0) {
      await saveSession(frames, socketId);
    }

    sessionStore.deleteSession(socketId);

    return frames;
  } finally {
    finalizedSessions.delete(socketId);
  }
}
  async function saveAllSessions() {
    for (const [socketId, frames] of sessionStore.entries()) {
      if (frames.length > 0) {
        await saveSession(frames, socketId);
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
