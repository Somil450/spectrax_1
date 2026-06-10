const http = require("http");
const { Server } = require("socket.io");
const { getConfig } = require("../config/env");
const { createSocketOptions } = require("../config/socket");
const { SOCKET_AUTH_TOKEN, MAX_CONNECTIONS_PER_IP } = require("../config/constants");
const { createSessionStore } = require("../services/session.store");
const { createSessionService } = require("../services/session.service");
const { registerPoseSocketHandlers } = require("../socket/pose.socket");
const { registerSessionSocketHandlers } = require("../socket/session.socket");
const { createSocketAuthMiddleware } = require("../middlewares/socketAuth");
const { createSocketRateLimitMiddleware } = require("../middlewares/socketRateLimit");
const { createApp } = require("./createApp");
const { logger: defaultLogger } = require("../shared/utils/logger");

function createServer(overrides = {}) {
  // Move ipConnectionCount to function scope for multi-instance safety
  const ipConnectionCount = new Map();

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

  io.use(createSocketAuthMiddleware());

  io.use(
    createSocketRateLimitMiddleware({
      ipConnectionCount,
      maxConnectionsPerIp: config.maxConnectionsPerIp,
    }),
  );

  io.on("connection", (socket) => {
    logger.info(`[SpectraX] Client connected: ${socket.id}`);
    sessionStore.initializeSession(socket.id);

    socket.on("disconnect", () => {
      const ip = socket.handshake.address;
      const count = ipConnectionCount.get(ip) || 1;
      if (count <= 1) {
        ipConnectionCount.delete(ip);
      } else {
        ipConnectionCount.set(ip, count - 1);
      }
    });

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
