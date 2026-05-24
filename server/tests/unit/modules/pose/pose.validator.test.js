const {
  hasPoseLandmarks,
  isSupportedExercise,
  hasValidTimestamp,
} = require('../../../../src/modules/pose/pose.validator');

describe('pose.validator', () => {
  it('accepts pose landmark arrays with the current minimum size', () => {
    expect(hasPoseLandmarks(Array.from({ length: 29 }, () => ({})))).toBe(true);
    expect(hasPoseLandmarks(Array.from({ length: 28 }, () => ({})))).toBe(false);
  });

  it('recognizes the current supported exercise keys', () => {
    expect(isSupportedExercise('squat')).toBe(true);
    expect(isSupportedExercise('pushup')).toBe(true);
    expect(isSupportedExercise('burpee')).toBe(false);
  });

  it('accepts finite numeric timestamps', () => {
    expect(hasValidTimestamp(Date.now())).toBe(true);
    expect(hasValidTimestamp(Number.NaN)).toBe(false);
  });
});
