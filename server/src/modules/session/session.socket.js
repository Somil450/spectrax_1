const { hasSocketId } = require('./session.validator');

function registerSessionSocketHandlers({ socket, sessionService, logger }) {
  socket.on('session:end', async () => {
    try {
      if (!hasSocketId(socket.id)) {
        return;
      }

      const frames = await sessionService.finalizeSession(socket.id);
      logger.info(`[SpectraX] Session saved for ${socket.id} (${frames.length} frames)`);
    } catch (error) {
      logger.error(`[SpectraX] Failed to finalize session on session:end for ${socket.id}:`, error.message);
    }
  });

  socket.on('disconnect', async () => {
    try {
      if (!hasSocketId(socket.id)) {
        return;
      }

      await sessionService.finalizeSession(socket.id);
      logger.info(`[SpectraX] Client disconnected: ${socket.id}`);
    } catch (error) {
      logger.error(`[SpectraX] Failed to finalize session on disconnect for ${socket.id}:`, error.message);
    }
  });
}

module.exports = {
  registerSessionSocketHandlers,
};
