const { computeAngles } = require("./angleUtils");
const { generateFeedback } = require("./feedbackEngine");

function processPose(data) {
  const { landmarks, timestamp, exercise = "squat" } = data;

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

module.exports = {
  processPose,
};
