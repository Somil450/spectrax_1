/**
 * SpectraX Real-Time Backend
 * Express + Socket.IO — ultra-low latency pose processing
 * Port: 3001
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");

// ─── Config Imports ────────────────────────────────────────────────────────
const { PORT, SESSIONS_DIR, SOCKET_AUTH_TOKEN } = require("./config/constants");
const { createCorsOptions } = require("./config/cors");

// ─── Middleware Imports ────────────────────────────────────────────────────
const errorHandler = require("./middleware/errorHandler");

// ─── Socket & Route Imports ────────────────────────────────────────────────
const setupSocketHandlers = require("./socket/handlers");
const setupHealthRoute = require("./modules/healthRoute");

// ─── App Setup ─────────────────────────────────────────────────────────────
const corsConfig = createCorsOptions({
  corsOrigin: process.env.ALLOWED_ORIGIN || process.env.CORS_ORIGIN,
});

const app = express();
app.use(cors(corsConfig));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsConfig,
  // Tune for minimal latency
  pingInterval: 5000,
  pingTimeout: 3000,
  transports: ["websocket"], // Skip polling entirely
});

// ─── Socket Authentication ────────────────────────────────────────────────
io.use((socket, next) => {
  if (SOCKET_AUTH_TOKEN === null) {
    // Not configured: reject in production, warn and allow in development
    if (process.env.NODE_ENV === 'production') {
      return next(new Error('Server misconfiguration: SOCKET_AUTH_TOKEN is not set'));
    }
    console.warn('[SpectraX] WARNING: SOCKET_AUTH_TOKEN is not set. All WebSocket connections accepted without authentication.');
    return next();
  }
  const token = socket.handshake.auth?.token;
  if (token === SOCKET_AUTH_TOKEN) return next();
  return next(new Error('Unauthorized'));
});

// ─── In-Memory Session Store (Per Socket) ─────────────────────────────────
const sessions = new Map(); // socketId → frame[]

// Ensure sessions directory exists before any session is saved
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// ─── Setup Routes & Socket Handlers ────────────────────────────────────────
setupHealthRoute(app, sessions);
setupSocketHandlers(io, sessions);

// ─── Global Error Handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ─── Graceful Shutdown ────────────────────────────────────────────────────
process.on("SIGINT", () => {
  const { saveSession } = require("./modules/sessionStorage");
  console.log("\n[SpectraX] Shutting down — saving all sessions...");
  for (const [id, frames] of sessions) {
    if (frames.length > 0) saveSession(frames, id);
  }
  server.close(() => {
    console.log("[SpectraX] Server closed.");
    process.exit(0);
  });
});

module.exports = { app, server, PORT };
