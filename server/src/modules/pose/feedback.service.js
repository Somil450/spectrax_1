function generateFeedback(angles, exercise) {
  const corrections = [];

  if (!angles || Object.keys(angles).length === 0) {
    return { status: "yellow", message: "Acquiring pose...", corrections: [] };
  }

  const FEEDBACK_THRESHOLDS = {
    squat: {
      KNEE_TOO_HIGH: 160,
      KNEE_TOO_LOW: 70,
      BODYLINE_MIN: 150,
    },
    bicepCurl: {
      ELBOW_NOT_CURLED: 160,
      ELBOW_NOT_EXTENDED: 30,
      SHOULDER_MAX: 20,
    },
    pushup: {
      ELBOW_NOT_LOWERED: 160,
      BODYLINE_MIN: 160,
    },
    plank: {
      BODYLINE_MIN: 155,
      SHOULDER_MIN: 75,
    },
    jumpingJack: {
      SHOULDER_MIN: 70,
    },
  };

  function generateFeedback(angles, exercise) {
    switch (exercise) {
      case "squat":
        if (angles.knee > FEEDBACK_THRESHOLDS.squat.KNEE_TOO_HIGH)
          corrections.push("Lower your squat depth");
        if (angles.bodyLine < FEEDBACK_THRESHOLDS.squat.BODYLINE_MIN)
          corrections.push("Keep your back straight");
        if (angles.knee < FEEDBACK_THRESHOLDS.squat.KNEE_TOO_LOW)
          corrections.push("Avoid over-bending knees");
        break;

      case "bicepCurl":
        if (angles.elbow > FEEDBACK_THRESHOLDS.bicepCurl.ELBOW_NOT_CURLED)
          corrections.push("Curl higher — squeeze at top");
        if (angles.elbow < FEEDBACK_THRESHOLDS.bicepCurl.ELBOW_NOT_EXTENDED)
          corrections.push("Extend arm fully at bottom");
        if (angles.shoulder > FEEDBACK_THRESHOLDS.bicepCurl.SHOULDER_MAX)
          corrections.push("Keep elbows tucked at sides");
        break;

      case "pushup":
        if (angles.elbow > FEEDBACK_THRESHOLDS.pushup.ELBOW_NOT_LOWERED)
          corrections.push("Lower your chest to the ground");
        if (angles.bodyLine < FEEDBACK_THRESHOLDS.pushup.BODYLINE_MIN)
          corrections.push("Keep your body in a straight line");
        break;

      case "plank":
        if (angles.bodyLine < FEEDBACK_THRESHOLDS.plank.BODYLINE_MIN)
          corrections.push("Raise your hips — stay rigid");
        if (angles.shoulder < FEEDBACK_THRESHOLDS.plank.SHOULDER_MIN)
          corrections.push("Align shoulders over wrists");
        break;

      case "jumpingJack":
        if (angles.shoulder < FEEDBACK_THRESHOLDS.jumpingJack.SHOULDER_MIN)
          corrections.push("Raise arms fully overhead");
        break;

      default:
        break;
    }
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
