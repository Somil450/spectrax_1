const { hasSocketId } = require('./session.validator');

function registerSessionSocketHandlers({ socket, sessionService, logger }) {
  socket.on('session:end', async () => {
    if (!hasSocketId(socket.id)) {
      return;
    }

    const frames = await sessionService.finalizeSession(socket.id);
    logger.info(`[SpectraX] Session saved for ${socket.id} (${frames.length} frames)`);
  });

  socket.on('disconnect', async () => {
    if (!hasSocketId(socket.id)) {
      return;
    }

    await sessionService.finalizeSession(socket.id);
    logger.info(`[SpectraX] Client disconnected: ${socket.id}`);
  });
}

module.exports = {
  registerSessionSocketHandlers,
};
