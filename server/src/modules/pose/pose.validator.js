const { SUPPORTED_EXERCISES } = require('../../shared/constants/exercises');

const LANDMARK_COUNT_MIN = 29;
const LANDMARK_COUNT_MAX = 33;

function hasValidLandmarkObject(value) {
  return (
    !!value &&
    typeof value.x === 'number' &&
    typeof value.y === 'number'
  );
}

function hasPoseLandmarks(landmarks) {
  if (!Array.isArray(landmarks)) return false;
  if (landmarks.length < LANDMARK_COUNT_MIN) return false;
  if (landmarks.length > LANDMARK_COUNT_MAX) return false;
  for (let i = 0; i < landmarks.length; i++) {
    if (!hasValidLandmarkObject(landmarks[i])) return false;
  }
  return true;
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
  LANDMARK_COUNT_MIN,
  LANDMARK_COUNT_MAX,
};
