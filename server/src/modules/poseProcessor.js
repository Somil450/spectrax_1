const { computeAngles } = require("./angleUtils");
const { generateFeedback } = require("./feedbackEngine");

function processPose(data) {
  if (!data || !Array.isArray(data.landmarks) || data.landmarks.length < 29) {
    throw new TypeError("processPose: invalid or missing landmarks in payload");
  }
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
