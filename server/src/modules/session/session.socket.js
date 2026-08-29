const { hasSocketId } = require('./session.validator');

function registerSessionSocketHandlers({ socket, sessionService, logger }) {
  socket.on('session:end', async () => {
    try {
      if (!hasSocketId(socket.id)) {
        return;
      }

      const frames = await sessionService.finalizeSession(socket.id);
      if (frames.length > 0) {
        logger.info(`[SpectraX] Session saved for ${socket.id} (${frames.length} frames)`);
      }
    } catch (error) {
      logger.error(`[SpectraX] Failed to finalize session on session:end for ${socket.id}:`, error.message);
      socket.emit('session:error', { message: 'Failed to save workout — your session is still available. Please try again.' });
    }
  });

  socket.on('session:retry', async () => {
    try {
      if (!hasSocketId(socket.id)) {
        return;
      }

      const frames = await sessionService.retryFinalize(socket.id);
      if (frames) {
        logger.info(`[SpectraX] Session retried and saved for ${socket.id} (${frames.length} frames)`);
      }
    } catch (error) {
      logger.error(`[SpectraX] Failed to retry session for ${socket.id}:`, error.message);
      socket.emit('session:error', { message: 'Retry failed — please try saving again.' });
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
