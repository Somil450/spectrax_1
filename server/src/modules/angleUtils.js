function calculateAngle(a, b, c) {
  if (!a || !b || !c) return 0;
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360.0 - angle;
  return Math.round(angle);
}

function getBestSide(lm) {
  const leftVis =
    [11, 13, 15, 23, 25, 27].reduce((s, i) => s + (lm[i]?.visibility || 0), 0) /
    6;
  const rightVis =
    [12, 14, 16, 24, 26, 28].reduce((s, i) => s + (lm[i]?.visibility || 0), 0) /
    6;
  return leftVis >= rightVis ? "left" : "right";
}

function computeAngles(landmarks) {
  if (!landmarks || landmarks.length < 29) return {};
  const side = getBestSide(landmarks);
  const ids =
    side === "left"
      ? { s: 11, e: 13, w: 15, h: 23, k: 25, a: 27 }
      : { s: 12, e: 14, w: 16, h: 24, k: 26, a: 28 };

  return {
    knee: calculateAngle(landmarks[ids.h], landmarks[ids.k], landmarks[ids.a]),
    elbow: calculateAngle(landmarks[ids.s], landmarks[ids.e], landmarks[ids.w]),
    shoulder: calculateAngle(
      landmarks[ids.e],
      landmarks[ids.s],
      landmarks[ids.h],
    ),
    bodyLine: calculateAngle(
      landmarks[ids.s],
      landmarks[ids.h],
      landmarks[ids.a],
    ),
    hipDepth:
      landmarks[ids.h] && landmarks[ids.a]
        ? Math.round(Math.abs(landmarks[ids.h].y - landmarks[ids.a].y) * 100)
        : 0,
  };
}

module.exports = {
  calculateAngle,
  getBestSide,
  computeAngles,
};
