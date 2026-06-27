const fs = require('fs');
const path = require('path');
const { buildSessionFilePath } = require('../../shared/utils/paths');

const SESSION_FILE_TTL_DAYS = parseInt(process.env.SESSION_FILE_TTL_DAYS || '7');
const CLEANUP_INTERVAL_HOURS = parseInt(process.env.CLEANUP_INTERVAL_HOURS || '24');

function createSessionService({ sessionStore, sessionPath, maxSessionFrames, logger }) {
  let cleanupIntervalId = null;
  const finalizedSessions = new Set();

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

  async function cleanupOldSessions() {
    try {
      const parsed = path.parse(sessionPath);
      const sessionDir = parsed.dir;
      const filePrefix = `${parsed.name}-`;
      const fileExt = parsed.ext || '.json';

      if (!fs.existsSync(sessionDir)) {
        return;
      }
      const files = await fs.promises.readdir(sessionDir);
      const now = Date.now();
      const ttlMs = SESSION_FILE_TTL_DAYS * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        if (!file.startsWith(filePrefix) || !file.endsWith(fileExt)) {
          continue;
        }
        const filePath = path.join(sessionDir, file);
        const stats = await fs.promises.stat(filePath);
        const fileAge = now - stats.mtime.getTime();
        if (fileAge > ttlMs) {
          await fs.promises.unlink(filePath);
          deletedCount++;
        }
      }
      if (deletedCount > 0) {
        logger.info(`[SpectraX] Cleaned up ${deletedCount} old session files`);
      }
    } catch (error) {
      logger.error('[SpectraX] Session cleanup failed:', error.message);
    }
  }

  async function startCleanupRoutine() {
    await cleanupOldSessions();
    cleanupIntervalId = setInterval(
      cleanupOldSessions,
      CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000
    );
  }

  function stopCleanupRoutine() {
    if (cleanupIntervalId) {
      clearInterval(cleanupIntervalId);
      cleanupIntervalId = null;
    }
  }

  startCleanupRoutine().catch(error => {
    logger.error('[SpectraX] Failed to start cleanup routine:', error.message);
  });

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
    cleanupOldSessions,
    startCleanupRoutine,
    stopCleanupRoutine,
  };
}

module.exports = {
  createSessionService,
};
