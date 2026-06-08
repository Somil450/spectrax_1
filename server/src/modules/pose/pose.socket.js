const { MAX_FRAMES_PER_SEC } = require('../../config');

function registerPoseSocketHandlers({ socket, sessionService }) {
  const frameTimestamps = new Map();
  
  frameTimestamps.set(socket.id, []);

  socket.on('frame', (data) => {
    const timestamps = frameTimestamps.get(socket.id) || [];
    const now = Date.now();
    const recent = timestamps.filter(t => now - t < 1000);

    if (recent.length >= MAX_FRAMES_PER_SEC) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }

    recent.push(now);
    frameTimestamps.set(socket.id, recent);

    sessionService.appendFrame(socket.id, data);
  });

  socket.on('disconnect', () => {
    frameTimestamps.delete(socket.id);
  });
}

module.exports = {
  registerPoseSocketHandlers,
};
