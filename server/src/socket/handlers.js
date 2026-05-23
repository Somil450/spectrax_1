const { processPose } = require("../modules/poseProcessor");
const { saveSession, MAX_SESSION_FRAMES } = require("../modules/sessionStorage");

function setupSocketHandlers(io, sessions) {
  io.on("connection", (socket) => {
    console.log(`[SpectraX] Client connected: ${socket.id}`);
    sessions.set(socket.id, []);

    let frameWindowStart = Date.now();
    let frameCountInWindow = 0;
    const { MAX_FRAMES_PER_SEC } = require("../config/constants");

    // ── Real-time frame processing ──
    socket.on("frame", (data) => {
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
      socket.emit("feedback", {
        angles: result.angles,
        corrections: result.corrections,
        status: result.status,
        feedback: result.feedback,
        timestamp: result.timestamp,
      });
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
      console.log(`[SpectraX] Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = setupSocketHandlers;
