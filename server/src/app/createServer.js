const http = require("http");
const { Server } = require("socket.io");
const { getConfig } = require("../config/env");
const { createSocketOptions } = require("../config/socket");
const admin = require("firebase-admin");
const { createSessionStore } = require("../modules/session/session.store");
const { createSessionService } = require("../modules/session/session.service");
const { registerPoseSocketHandlers } = require("../modules/pose/pose.socket");
const {
  registerSessionSocketHandlers,
} = require("../modules/session/session.socket");
const { createApp } = require("./createApp");
const { logger: defaultLogger } = require("../shared/utils/logger");

function resolveClientIp(socket, trustProxy) {
  const direct = socket.handshake.address;
  if (!trustProxy || trustProxy <= 0) {
    return direct;
  }
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  if (!forwarded) {
    return direct;
  }
  const chain = String(forwarded)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return chain[chain.length - trustProxy] || direct;
}

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

  // Initialize Firebase Admin if not already initialized
  if (!admin.getApps().length) {
    admin.initializeApp({
      projectId: config.firebaseProjectId || process.env.FIREBASE_PROJECT_ID || 'demo-project',
    });
  }

  // WebSocket Authentication Middleware using Firebase Admin
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        if (process.env.NODE_ENV !== "production") {
          if (logger.warn) {
            logger.warn("[SpectraX] Missing auth token. Proceeding as guest (development only).");
          } else {
            logger.info("[SpectraX] Missing auth token. Proceeding as guest (development only).");
          }
          socket.user = { uid: "guest_user", isGuest: true };
          return next();
        }
        return next(new Error("Authentication failed: missing token"));
      }
      
      // Verify the Firebase JWT
      const decodedToken = await admin.auth().verifyIdToken(token);
      socket.user = decodedToken;
      next();
    } catch (error) {
      logger.error("[SpectraX] WebSocket JWT Auth Failed:", error.message);
      next(new Error("Authentication failed: invalid token"));
    }
  });

  io.use((socket, next) => {
    const ip = resolveClientIp(socket, config.trustProxy);
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
      const ip = resolveClientIp(socket, config.trustProxy);
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
  resolveClientIp,
};
