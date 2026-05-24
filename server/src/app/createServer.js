const http = require("http");
const { Server } = require("socket.io");
const { getConfig } = require("../config/env");
const { createSocketOptions } = require("../config/socket");
const { createSessionStore } = require("../modules/session/session.store");
const { createSessionService } = require("../modules/session/session.service");
const { registerPoseSocketHandlers } = require("../modules/pose/pose.socket");
const {
  registerSessionSocketHandlers,
} = require("../modules/session/session.socket");
const { createApp } = require("./createApp");
const { logger: defaultLogger } = require("../shared/utils/logger");

function createServer(overrides = {}) {
  const config = getConfig(overrides);
  const logger = overrides.logger || defaultLogger;
  const sessionStore = createSessionStore();
  const sessionService = createSessionService({
    sessionStore,
    sessionPath: config.sessionPath,
    maxSessionFrames: config.maxSessionFrames,
    logger,
  });
  const app = createApp({ sessionStore, config });
  const server = http.createServer(app);
  const io = new Server(server, createSocketOptions(config));

  io.on("connection", (socket) => {
    logger.info(`[SpectraX] Client connected: ${socket.id}`);
    sessionStore.initializeSession(socket.id);

    registerPoseSocketHandlers({
      socket,
      sessionService,
    });

    registerSessionSocketHandlers({
      socket,
      sessionService,
      logger,
    });
  });

  function start() {
    return new Promise((resolve, reject) => {
      server.listen(config.port, () => resolve(server));
      server.on("error", reject);
    });
  }

  async function shutdown() {
    try {
      await sessionService.saveAllSessions();
    } catch (error) {
      logger.error("Error saving sessions during shutdown:", error);
    }
    return new Promise((resolve, reject) => {
      if (!server.listening) {
        resolve();
        return;
      }

      io.close(() => {
        if (!server.listening) {
          resolve();
          return;
        }

        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    });
  }

  return {
    app,
    server,
    io,
    config,
    sessionStore,
    start,
    shutdown,
  };
}

module.exports = {
  createServer,
};
