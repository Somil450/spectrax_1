const { DEFAULT_EXERCISE } = require("../../shared/constants/exercises");
const { processPose } = require("./pose.service");
const {
  hasPoseLandmarks,
  hasValidTimestamp,
  isSupportedExercise,
} = require("./pose.validator");

function registerPoseSocketHandlers({ socket, sessionService }) {
  socket.on("frame", (data) => {
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
}

module.exports = {
  registerPoseSocketHandlers,
};
