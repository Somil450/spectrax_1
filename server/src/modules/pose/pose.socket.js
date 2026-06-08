const { DEFAULT_EXERCISE } = require("../../shared/constants/exercises");
const { processPose } = require("./pose.service");
const {
  hasPoseLandmarks,
  hasValidTimestamp,
  isSupportedExercise,
} = require("./pose.validator");
const { MAX_FRAMES_PER_SEC } = require("../../config/constants");

function registerPoseSocketHandlers({ socket, sessionService }) {
  // Move frameTimestamps to function scope for test isolation
  const frameTimestamps = new Map();
  frameTimestamps.set(socket.id, []);

  socket.on("frame", (data) => {
    const now = Date.now();
    const timestamps = frameTimestamps.get(socket.id) || [];
    const recent = timestamps.filter((t) => now - t < 1000);
    if (recent.length >= MAX_FRAMES_PER_SEC) {
      return;
    }
    recent.push(now);
    frameTimestamps.set(socket.id, recent);

    if (
      !hasPoseLandmarks(data && data.landmarks) ||
      !hasValidTimestamp(data && data.timestamp)
    ) {
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
  });
}

module.exports = {
  registerPoseSocketHandlers,
};
