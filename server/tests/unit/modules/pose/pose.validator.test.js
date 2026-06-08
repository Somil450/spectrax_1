const {
  hasPoseLandmarks,
  isSupportedExercise,
  hasValidTimestamp,
} = require('../../../../src/modules/pose/pose.validator');

function createLandmark() {
  return { x: 0, y: 0 };
}

describe('pose.validator', () => {
  it('validates landmarks array length and object shape', () => {
    expect(hasPoseLandmarks(Array.from({ length: 29 }, createLandmark))).toBe(true);
    expect(hasPoseLandmarks(Array.from({ length: 28 }, createLandmark))).toBe(false);
    expect(hasPoseLandmarks(Array.from({ length: 34 }, createLandmark))).toBe(false);
    expect(hasPoseLandmarks(Array.from({ length: 33 }, createLandmark))).toBe(true);
    expect(hasPoseLandmarks(Array.from({ length: 29 }, () => ({})))).toBe(false);
    expect(hasPoseLandmarks(Array.from({ length: 29 }, () => ({ x: 0 })))).toBe(false);
    expect(hasPoseLandmarks(Array.from({ length: 29 }, () => ({ x: 'a', y: 0 })))).toBe(false);
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
