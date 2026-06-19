const http = require("http");
const { Server } = require("socket.io");
const { getConfig } = require("../config/env");
const { createSocketOptions } = require("../config/socket");
const { SOCKET_AUTH_TOKEN } = require("../config/constants");
const { createSessionStore } = require("../modules/session/session.store");
const { createSessionService } = require("../modules/session/session.service");
const { registerPoseSocketHandlers } = require("../modules/pose/pose.socket");
const {
  registerSessionSocketHandlers,
} = require("../modules/session/session.socket");
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

  io.use((socket, next) => {
    if (!SOCKET_AUTH_TOKEN) {
      if (process.env.NODE_ENV === "production") {
        return next(new Error("Server misconfiguration: SOCKET_AUTH_TOKEN is not set"));
      }
      console.warn(
        "[SpectraX] WARNING: SOCKET_AUTH_TOKEN is not configured. " +
        "All WebSocket connections accepted without authentication.",
      );
      return next();
    }
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token !== SOCKET_AUTH_TOKEN) {
      return next(new Error("Authentication failed: invalid or missing token"));
    }
    next();
  });

  io.use((socket, next) => {
    const ip = socket.handshake.address;
    const count = (ipConnectionCount.get(ip) || 0) + 1;
    if (count > config.maxConnectionsPerIp) {
      return next(new Error(`Connection limit exceeded for ${ip}`));
    }
    ipConnectionCount.set(ip, count);
    next();
  });

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
