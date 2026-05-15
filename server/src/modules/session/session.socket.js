function registerSessionSocketHandlers({ socket, sessionService, logger }) {
  socket.on("session:end", () => {
    const frames = sessionService.finalizeSession(socket.id);
    logger.info(
      `[SpectraX] Session saved for ${socket.id} (${frames.length} frames)`,
    );
  });

  socket.on("disconnect", () => {
    sessionService.finalizeSession(socket.id);
    logger.info(`[SpectraX] Client disconnected: ${socket.id}`);
  });
}

module.exports = {
  registerSessionSocketHandlers,
};
