const { processPose } = require("./pose.service");

function registerPoseSocketHandlers({ socket, sessionService }) {
  socket.on("frame", (data) => {
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
  });
}

module.exports = {
  registerPoseSocketHandlers,
};
