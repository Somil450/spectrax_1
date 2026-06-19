function calculateAngle(a, b, c) {
  if (!a || !b || !c) return null;

  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360.0 - angle;
  }

  return Math.round(angle);
}

function getBestSide(landmarks) {
  const leftVisibility =
    [11, 13, 15, 23, 25, 27].reduce(
      (sum, index) =>
        sum +
        (landmarks[index] && landmarks[index].visibility
          ? landmarks[index].visibility
          : 0),
      0,
    ) / 6;
  const rightVisibility =
    [12, 14, 16, 24, 26, 28].reduce(
      (sum, index) =>
        sum +
        (landmarks[index] && landmarks[index].visibility
          ? landmarks[index].visibility
          : 0),
      0,
    ) / 6;

  return leftVisibility >= rightVisibility ? "left" : "right";
}

function computeSideAngles(landmarks, side) {
  const ids =
    side === "left"
      ? { s: 11, e: 13, w: 15, h: 23, k: 25, a: 27 }
      : { s: 12, e: 14, w: 16, h: 24, k: 26, a: 28 };

  return {
    knee: calculateAngle(landmarks[ids.h], landmarks[ids.k], landmarks[ids.a]),
    elbow: calculateAngle(landmarks[ids.s], landmarks[ids.e], landmarks[ids.w]),
    shoulder: calculateAngle(landmarks[ids.e], landmarks[ids.s], landmarks[ids.h]),
    bodyLine: calculateAngle(landmarks[ids.s], landmarks[ids.h], landmarks[ids.a]),
    hipDepth:
      landmarks[ids.h] && landmarks[ids.a]
        ? Math.round(Math.abs(landmarks[ids.h].y - landmarks[ids.a].y) * 100)
        : 0,
  };
}

function averageAngle(a, b) {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return Math.round((a + b) / 2);
}

function mergeAngles(left, right) {
  return {
    knee: averageAngle(left.knee, right.knee),
    elbow: averageAngle(left.elbow, right.elbow),
    shoulder: averageAngle(left.shoulder, right.shoulder),
    bodyLine: averageAngle(left.bodyLine, right.bodyLine),
    hipDepth: Math.round((left.hipDepth + right.hipDepth) / 2),
  };
}

const BILATERAL_EXERCISES = ["squat", "pushup", "plank", "jumpingJack"];

function computeAngles(landmarks, exercise = "squat") {
  if (!landmarks || landmarks.length < 29) return {};

  if (BILATERAL_EXERCISES.includes(exercise)) {
    const left = computeSideAngles(landmarks, "left");
    const right = computeSideAngles(landmarks, "right");
    return mergeAngles(left, right);
  }

  const side = getBestSide(landmarks);
  return computeSideAngles(landmarks, side);
}

module.exports = {
  calculateAngle,
  getBestSide,
  computeSideAngles,
  computeAngles,
};
 