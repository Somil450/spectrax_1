function generateFeedback(angles, exercise) {
  const corrections = [];

  if (!angles || Object.keys(angles).length === 0) {
    return { status: "yellow", message: "Acquiring pose...", corrections: [] };
  }

  switch (exercise) {
    case "squat":
      if (angles.knee > 160) corrections.push("Lower your squat depth");
      if (angles.bodyLine < 150) corrections.push("Keep your back straight");
      if (angles.knee < 70) corrections.push("Avoid over-bending knees");
      break;

    case "bicepCurl":
      if (angles.elbow > 160) corrections.push("Curl higher — squeeze at top");
      if (angles.elbow < 30) corrections.push("Extend arm fully at bottom");
      if (angles.shoulder > 20) corrections.push("Keep elbows tucked at sides");
      break;

    case "pushup":
      if (angles.elbow > 160)
        corrections.push("Lower your chest to the ground");
      if (angles.bodyLine < 160)
        corrections.push("Keep your body in a straight line");
      break;

    case "plank":
      if (angles.bodyLine < 155)
        corrections.push("Raise your hips — stay rigid");
      if (angles.shoulder < 75) corrections.push("Align shoulders over wrists");
      break;

    case "jumpingJack":
      if (angles.shoulder < 70) corrections.push("Raise arms fully overhead");
      break;

    default:
      break;
  }

  const status =
    corrections.length === 0
      ? "green"
      : corrections.length <= 1
        ? "yellow"
        : "red";
  const message = corrections.length === 0 ? "Good form ✅" : corrections[0];

  return { status, message, corrections };
}

module.exports = {
  generateFeedback,
};
