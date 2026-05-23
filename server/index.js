/**
 * SpectraX Real-Time Backend
 * Express + Socket.IO — ultra-low latency pose processing
 * Port: 3001
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// ─── App Setup ────────────────────────────────────────────────────────────────
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(','))
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const SOCKET_AUTH_TOKEN = process.env.SOCKET_AUTH_TOKEN || '';
const MAX_FRAMES_PER_SEC = Number(process.env.MAX_FRAMES_PER_SEC) || 60;

function isOriginAllowed(origin) {
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

const corsOptions = {
  origin: (origin, callback) =>
    isOriginAllowed(origin)
      ? callback(null, true)
      : callback(new Error('Origin not allowed by CORS')),
  methods: ['GET', 'POST'],
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
  // Tune for minimal latency
  pingInterval: 5000,
  pingTimeout: 3000,
  transports: ['websocket'], // Skip polling entirely
});

io.use((socket, next) => {
  if (!SOCKET_AUTH_TOKEN) return next();
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (token === SOCKET_AUTH_TOKEN) return next();
  return next(new Error('Unauthorized'));
});

const PORT = 3001;
const SESSIONS_DIR = path.join(__dirname, 'sessions');
const MAX_SESSION_FRAMES = 300; // Rolling buffer

// Ensure sessions directory exists before any session is saved
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// ─── In-Memory Session Store (Per Socket) ─────────────────────────────────────
const sessions = new Map(); // socketId → frame[]

// ─── Angle Computation (server-side mirror of angleUtils) ─────────────────────
function calculateAngle(a, b, c) {
  if (!a || !b || !c) return 0;
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360.0 - angle;
  return Math.round(angle);
}

function getBestSide(lm) {
  const leftVis  = [11,13,15,23,25,27].reduce((s,i) => s + (lm[i]?.visibility || 0), 0) / 6;
  const rightVis = [12,14,16,24,26,28].reduce((s,i) => s + (lm[i]?.visibility || 0), 0) / 6;
  return leftVis >= rightVis ? 'left' : 'right';
}

function computeAngles(landmarks) {
  if (!landmarks || landmarks.length < 29) return {};
  const side = getBestSide(landmarks);
  const ids = side === 'left'
    ? { s: 11, e: 13, w: 15, h: 23, k: 25, a: 27 }
    : { s: 12, e: 14, w: 16, h: 24, k: 26, a: 28 };

  return {
    knee:      calculateAngle(landmarks[ids.h], landmarks[ids.k], landmarks[ids.a]),
    elbow:     calculateAngle(landmarks[ids.s], landmarks[ids.e], landmarks[ids.w]),
    shoulder:  calculateAngle(landmarks[ids.e], landmarks[ids.s], landmarks[ids.h]),
    bodyLine:  calculateAngle(landmarks[ids.s], landmarks[ids.h], landmarks[ids.a]),
    hipDepth:  landmarks[ids.h] && landmarks[ids.a]
                 ? Math.round(Math.abs(landmarks[ids.h].y - landmarks[ids.a].y) * 100)
                 : 0,
  };
}

// ─── Feedback Engine ──────────────────────────────────────────────────────────
function generateFeedback(angles, exercise) {
  const corrections = [];

  if (!angles || Object.keys(angles).length === 0) {
    return { status: 'yellow', message: 'Acquiring pose...', corrections: [] };
  }

  switch (exercise) {
    case 'squat':
      if (angles.knee > 160) corrections.push('Lower your squat depth');
      if (angles.bodyLine < 150) corrections.push('Keep your back straight');
      if (angles.knee < 70)  corrections.push('Avoid over-bending knees');
      break;

    case 'bicepCurl':
      if (angles.elbow > 160) corrections.push('Curl higher — squeeze at top');
      if (angles.elbow < 30)  corrections.push('Extend arm fully at bottom');
      if (angles.shoulder > 20) corrections.push('Keep elbows tucked at sides');
      break;

    case 'pushup':
      if (angles.elbow > 160) corrections.push('Lower your chest to the ground');
      if (angles.bodyLine < 160) corrections.push('Keep your body in a straight line');
      break;

    case 'plank':
      if (angles.bodyLine < 155) corrections.push('Raise your hips — stay rigid');
      if (angles.shoulder < 75)  corrections.push('Align shoulders over wrists');
      break;

    case 'jumpingJack':
      if (angles.shoulder < 70) corrections.push('Raise arms fully overhead');
      break;

    default:
      break;
  }

  const status = corrections.length === 0 ? 'green' : corrections.length <= 1 ? 'yellow' : 'red';
  const message = corrections.length === 0 ? 'Good form ✅' : corrections[0];

  return { status, message, corrections };
}

// ─── Core: Process Pose Frame ─────────────────────────────────────────────────
function processPose(data) {
  const { landmarks, timestamp, exercise = 'squat' } = data;

  // Non-blocking: all synchronous math, no I/O
  const angles = computeAngles(landmarks);
  const { status, message, corrections } = generateFeedback(angles, exercise);

  return {
    timestamp,
    angles,
    status,
    feedback: message,
    corrections,
    exercise,
  };
}

// ─── Socket.IO Events ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[SpectraX] Client connected: ${socket.id}`);
  sessions.set(socket.id, []);

  let frameWindowStart = Date.now();
  let frameCountInWindow = 0;

  // ── Real-time frame processing ──
  socket.on('frame', (data) => {
    if (!data || !Array.isArray(data.landmarks)) return;

    const now = Date.now();
    if (now - frameWindowStart >= 1000) {
      frameWindowStart = now;
      frameCountInWindow = 0;
    }
    frameCountInWindow += 1;
    if (frameCountInWindow > MAX_FRAMES_PER_SEC) return;

    // Non-blocking inline — no setTimeout/setImmediate overhead for hot path
    const result = processPose(data);

    // Store frame in rolling buffer
    const sessionFrames = sessions.get(socket.id) || [];
    if (sessionFrames.length >= MAX_SESSION_FRAMES) {
      sessionFrames.shift(); // Drop oldest — O(1) amortized for small arrays
    }
    sessionFrames.push({
      timestamp: result.timestamp,
      landmarks: data.landmarks,
      angles: result.angles,
      feedback: result.feedback,
      exercise: result.exercise,
    });
    sessions.set(socket.id, sessionFrames);

    // Emit result back immediately
    socket.emit('feedback', {
      angles: result.angles,
      corrections: result.corrections,
      status: result.status,
      feedback: result.feedback,
      timestamp: result.timestamp,
    });
  });

  // ── Save session on explicit end ──
  socket.on('session:end', () => {
    const frames = sessions.get(socket.id) || [];
    if (frames.length > 0) {
      saveSession(frames, socket.id);
    }
    sessions.delete(socket.id);
    console.log(`[SpectraX] Session saved for ${socket.id} (${frames.length} frames)`);
  });

  socket.on('disconnect', () => {
    // Auto-save on unexpected disconnect
    const frames = sessions.get(socket.id) || [];
    if (frames.length > 0) {
      saveSession(frames, socket.id);
    }
    sessions.delete(socket.id);
    console.log(`[SpectraX] Client disconnected: ${socket.id}`);
  });
});

// ─── Session Persistence ──────────────────────────────────────────────────────
function saveSession(frames, socketId) {
  try {
    const sessionData = {
      savedAt: new Date().toISOString(),
      socketId,
      frameCount: frames.length,
      frames,
    };
    const safeId = socketId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `session-${safeId}-${Date.now()}.json`;
    const filePath = path.join(SESSIONS_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
    console.log(`[SpectraX] Session saved: ${filename} (${frames.length} frames)`);
  } catch (err) {
    console.error('[SpectraX] Failed to save session:', err.message);
  }
}

// ─── Health Check Endpoint ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    activeSessions: sessions.size,
    uptime: Math.round(process.uptime()),
  });
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n[SpectraX] Shutting down — saving all sessions...');
  for (const [id, frames] of sessions) {
    if (frames.length > 0) saveSession(frames, id);
  }
  server.close(() => {
    console.log('[SpectraX] Server closed.');
    process.exit(0);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 SpectraX Backend running on http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Health:    http://localhost:${PORT}/health\n`);
});
