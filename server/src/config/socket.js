function createSocketOptions(config) {
  return {
    cors: {
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
    },
    pingInterval: 5000,
    pingTimeout: 3000,
    transports: ["websocket"],
    path: config.socketPath,
  };
}

module.exports = {
  createSocketOptions,
};
