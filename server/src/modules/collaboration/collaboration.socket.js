// server/src/modules/collaboration/collaboration.socket.js
// Handles real-time collaborative workout sessions via Socket.io namespace

const { randomUUID } = require('crypto');

/**
 * In-memory session store for collaboration rooms.
 * Shape: Map<sessionId, { ownerId, participants: Set<socketId>, annotations: [], state: {} }>
 */
const collabSessions = new Map();

/**
 * Registers all collaboration socket event handlers on the /collab namespace.
 * @param {import('socket.io').Namespace} namespace
 * @param {object} logger
 */
function registerCollaborationHandlers(namespace, logger) {
  namespace.on('connection', (socket) => {
    logger.info(`[Collab] Socket connected: ${socket.id}`);

    // ── Create a new shared session ──────────────────────────────────────────
    socket.on('collab:create', ({ userId } = {}) => {
      const sessionId = randomUUID();
      collabSessions.set(sessionId, {
        ownerId: socket.id,
        userId: userId ?? null,
        participants: new Set([socket.id]),
        annotations: [],
        state: {},
        createdAt: Date.now(),
      });
      socket.join(sessionId);
      socket.emit('collab:created', { sessionId });
      logger.info(`[Collab] Session created: ${sessionId} by ${socket.id}`);
    });

    // ── Join an existing shared session ──────────────────────────────────────
    socket.on('collab:join', ({ sessionId } = {}) => {
      const session = collabSessions.get(sessionId);
      if (!session) {
        socket.emit('collab:error', { message: 'Session not found or expired.' });
        return;
      }
      session.participants.add(socket.id);
      socket.join(sessionId);

      // Send current session state to the new joiner
      socket.emit('collab:state-sync', {
        annotations: session.annotations,
        state: session.state,
        participantCount: session.participants.size,
      });

      // Notify others someone joined
      socket.to(sessionId).emit('collab:participant-joined', {
        participantCount: session.participants.size,
      });
      logger.info(`[Collab] ${socket.id} joined session ${sessionId}`);
    });

    // ── Broadcast live workout state (reps, accuracy, etc.) ──────────────────
    socket.on('collab:state-update', ({ sessionId, state } = {}) => {
      const session = collabSessions.get(sessionId);
      if (!session || session.ownerId !== socket.id) return; // only owner pushes state
      session.state = { ...session.state, ...state };
      socket.to(sessionId).emit('collab:state-update', { state: session.state });
    });

    // ── Add an annotation ────────────────────────────────────────────────────
    socket.on('collab:annotate', ({ sessionId, annotation } = {}) => {
      const session = collabSessions.get(sessionId);
      if (!session) return;
      const entry = {
        id: randomUUID(),
        socketId: socket.id,
        text: annotation.text ?? '',
        timestamp: Date.now(),
      };
      session.annotations.push(entry);
      // Broadcast to everyone in the room including sender
      namespace.to(sessionId).emit('collab:annotation-added', { annotation: entry });
    });

    // ── Cursor presence ───────────────────────────────────────────────────────
    socket.on('collab:cursor', ({ sessionId, x, y, label } = {}) => {
      socket.to(sessionId).emit('collab:cursor-update', {
        socketId: socket.id,
        x, y, label,
      });
    });

    // ── Clean up on disconnect ────────────────────────────────────────────────
    socket.on('disconnect', () => {
      for (const [sessionId, session] of collabSessions.entries()) {
        if (session.participants.has(socket.id)) {
          session.participants.delete(socket.id);
          socket.to(sessionId).emit('collab:participant-left', {
            participantCount: session.participants.size,
          });
          // Remove empty sessions after 10 minutes of inactivity
          if (session.participants.size === 0) {
            setTimeout(() => {
              if (collabSessions.get(sessionId)?.participants.size === 0) {
                collabSessions.delete(sessionId);
                logger.info(`[Collab] Session expired and removed: ${sessionId}`);
              }
            }, 10 * 60 * 1000);
          }
        }
      }
      logger.info(`[Collab] Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { registerCollaborationHandlers };