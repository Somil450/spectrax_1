const { SUPPORTED_EXERCISES } = require('../../shared/constants/exercises');

function hasPoseLandmarks(landmarks) {
  return Array.isArray(landmarks) && landmarks.length >= 29;
}

function isSupportedExercise(exercise) {
  return SUPPORTED_EXERCISES.includes(exercise);
}

function hasValidTimestamp(timestamp) {
  return Number.isFinite(timestamp);
}

module.exports = {
  hasPoseLandmarks,
  isSupportedExercise,
  hasValidTimestamp,
};
