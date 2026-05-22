function createSessionStore() {
  const sessions = new Map();

  return {
    initializeSession(socketId) {
      sessions.set(socketId, []);
    },
    getSessionFrames(socketId) {
      return sessions.get(socketId) || [];
    },
    setSessionFrames(socketId, frames) {
      sessions.set(socketId, frames);
    },
    deleteSession(socketId) {
      sessions.delete(socketId);
    },
    entries() {
      return sessions.entries();
    },
    size() {
      return sessions.size;
    },
  };
}

module.exports = {
  createSessionStore,
};
