const { processPose } = require("./pose.service");

function registerPoseSocketHandlers({ socket, sessionService }) {
  socket.on("frame", (data) => {
    try {
      const result = processPose(data);

      sessionService.appendFrame(socket.id, {
        timestamp: result.timestamp,
        landmarks: data.landmarks,
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
      console.error("Error processing frame:", error);
      socket.emit("feedback", {
        status: "red",
        feedback: "Error processing pose data",
        corrections: [],
        angles: {},
        timestamp: data?.timestamp || Date.now(),
      });
    }
  });
}

module.exports = {
  registerPoseSocketHandlers,
};
