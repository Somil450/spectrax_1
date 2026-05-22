function hasSessionFrames(frames) {
  return Array.isArray(frames) && frames.length > 0;
}

function hasSocketId(socketId) {
  return typeof socketId === 'string' && socketId.length > 0;
}

module.exports = {
  hasSessionFrames,
  hasSocketId,
};
