const { processPose } = require("../modules/poseProcessor");
const { saveSession, MAX_SESSION_FRAMES } = require("../modules/sessionStorage");

// Global rooms map for multiplayer workout sessions
const rooms = new Map();

function setupSocketHandlers(io, sessions) {
  io.on("connection", (socket) => {
    console.log(`[SpectraX] Client connected: ${socket.id}`);
    sessions.set(socket.id, []);

    let frameWindowStart = Date.now();
    let frameCountInWindow = 0;
    const { MAX_FRAMES_PER_SEC } = require("../config/constants");

    // ── Real-time frame processing ──
    socket.on("frame", (data) => {
      if (!data || !Array.isArray(data.landmarks) || data.landmarks.length < 29) return;

      const now = Date.now();
      if (now - frameWindowStart >= 1000) {
        frameWindowStart = now;
        frameCountInWindow = 0;
      }
      frameCountInWindow += 1;
      if (frameCountInWindow > MAX_FRAMES_PER_SEC) return;

      let result;
      try {
        // Non-blocking inline — no setTimeout/setImmediate overhead for hot path
        result = processPose(data);
      } catch (err) {
        console.error("[SpectraX] Error processing frame:", err.message);
        socket.emit("feedback", {
          angles: {},
          corrections: [],
          status: "red",
          feedback: "Error processing pose",
          timestamp: data.timestamp ?? null,
        });
        return;
      }

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
      socket.emit("feedback", {
        angles: result.angles,
        corrections: result.corrections,
        status: result.status,
        feedback: result.feedback,
        timestamp: result.timestamp,
      });
    });

    // ── Multi-user Live Workout Rooms ──
    socket.on("room:create", ({ name }) => {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      rooms.set(roomCode, {
        hostId: socket.id,
        participants: [{ socketId: socket.id, name, reps: 0, score: 100, state: "idle" }],
        mode: "battle",
        active: false,
      });
      socket.join(roomCode);
      socket.emit("room:created", { roomCode, participants: rooms.get(roomCode).participants });
      console.log(`[Multiplayer] Room created: ${roomCode} by host: ${name}`);
    });

    socket.on("room:join", ({ roomCode, name }) => {
      const room = rooms.get(roomCode);
      if (!room) {
        socket.emit("room:error", "Room not found");
        return;
      }
      if (room.participants.length >= 6) {
        socket.emit("room:error", "Room is full");
        return;
      }
      room.participants.push({ socketId: socket.id, name, reps: 0, score: 100, state: "idle" });
      socket.join(roomCode);
      io.to(roomCode).emit("room:updated", { roomCode, participants: room.participants, mode: room.mode });
      console.log(`[Multiplayer] User ${name} joined Room: ${roomCode}`);
    });

    socket.on("room:update-stats", ({ roomCode, reps, score, state }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const p = room.participants.find(x => x.socketId === socket.id);
      if (p) {
        p.reps = reps;
        p.score = score;
        p.state = state;
      }
      io.to(roomCode).emit("room:updated", { roomCode, participants: room.participants, mode: room.mode });

      // Live Battle logic: Check win/lose conditions
      if (room.active) {
        if (room.mode === "race" && reps >= 50) {
          room.active = false;
          io.to(roomCode).emit("room:game-over", { winner: p.name, reason: "First to 50 reps!" });
        }
      }
    });

    socket.on("room:start-game", ({ roomCode, mode }) => {
      const room = rooms.get(roomCode);
      if (!room || room.hostId !== socket.id) return;
      room.mode = mode || "battle";
      room.active = true;
      room.participants.forEach(p => { p.reps = 0; p.score = 100; p.state = "active"; });
      io.to(roomCode).emit("room:started", { mode: room.mode, participants: room.participants });
      console.log(`[Multiplayer] Game started in Room: ${roomCode} in ${mode} mode`);
    });

    // ── Save session on explicit end ──
    socket.on("session:end", () => {
      const frames = sessions.get(socket.id) || [];
      if (frames.length > 0) {
        saveSession(frames, socket.id);
      }
      sessions.delete(socket.id);
      console.log(
        `[SpectraX] Session saved for ${socket.id} (${frames.length} frames)`,
      );
    });

    socket.on("disconnect", () => {
      // Auto-save on unexpected disconnect
      const frames = sessions.get(socket.id) || [];
      if (frames.length > 0) {
        saveSession(frames, socket.id);
      }
      sessions.delete(socket.id);

      // Handle room cleanup on disconnect
      for (const [roomCode, room] of rooms.entries()) {
        const idx = room.participants.findIndex(p => p.socketId === socket.id);
        if (idx !== -1) {
          room.participants.splice(idx, 1);
          if (room.participants.length === 0) {
            rooms.delete(roomCode);
            console.log(`[Multiplayer] Room ${roomCode} deleted (empty)`);
          } else {
            if (room.hostId === socket.id) {
              room.hostId = room.participants[0].socketId; // elect new host
            }
            io.to(roomCode).emit("room:updated", { roomCode, participants: room.participants, mode: room.mode });
          }
        }
      }

      console.log(`[SpectraX] Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = setupSocketHandlers;
