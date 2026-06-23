const { DEFAULT_EXERCISE } = require("../../shared/constants/exercises");
const { processPose } = require("./pose.service");
const {
  hasPoseLandmarks,
  hasValidTimestamp,
  isSupportedExercise,
} = require("./pose.validator");
const { MAX_FRAMES_PER_SEC } = require("../../config/constants");


function registerPoseSocketHandlers({ socket, sessionService }) {
  const frameTimestamps = new Map();
  const invalidFrameTimestamps = new Map();
  frameTimestamps.set(socket.id, []);
  invalidFrameTimestamps.set(socket.id, []);

  function withinRateLimit(store) {
    const now = Date.now();
    const recent = (store.get(socket.id) || []).filter((t) => now - t < 1000);
    if (recent.length >= MAX_FRAMES_PER_SEC) {
      return false;
    }
    recent.push(now);
    store.set(socket.id, recent);
    return true;
  }

  socket.on("frame", (data) => {
    if (
      !hasPoseLandmarks(data && data.landmarks) ||
      !hasValidTimestamp(data && data.timestamp)
    ) {
      if (!withinRateLimit(invalidFrameTimestamps)) {
        return;
      }
      socket.emit("feedback", {
        angles: {},
        corrections: [],
        status: "yellow",
        feedback: "Acquiring pose...",
        timestamp: hasValidTimestamp(data && data.timestamp)
          ? data.timestamp
          : null,
      });
      return;
    }

    if (!withinRateLimit(frameTimestamps)) {
      return;
    }

    const normalizedData = {
      ...data,
      exercise: isSupportedExercise(data.exercise)
        ? data.exercise
        : DEFAULT_EXERCISE,
    };
    try {
      const result = processPose(normalizedData);

      sessionService.appendFrame(socket.id, {
        timestamp: result.timestamp,
        landmarks: normalizedData.landmarks,
        angles: result.angles,
        feedback: result.feedback,
        exercise: result.exercise,
      });

      socket.emit("feedback", {
        angles: result.angles,
        corrections: result.corrections,
        status: result.status,
        feedback: result.feedback,
        timestamp: result.timestamp,
      });
    } catch (error) {
      console.error("Error processing pose frame:", error);
      socket.emit("feedback", {
        angles: {},
        corrections: [],
        status: "red",
        feedback: "Error processing pose",
        timestamp: data.timestamp,
      });
    }
  });

  socket.on("disconnect", () => {
    frameTimestamps.delete(socket.id);
    invalidFrameTimestamps.delete(socket.id);
  });
}

module.exports = {
  registerPoseSocketHandlers,
};
