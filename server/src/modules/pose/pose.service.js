const { DEFAULT_EXERCISE } = require('../../shared/constants/exercises');
const { computeAngles } = require('./angle.utils');
const { generateFeedback } = require('./feedback.service');

function processPose(data) {
  const { landmarks, timestamp, exercise = DEFAULT_EXERCISE } = data;
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
