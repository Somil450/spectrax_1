/**
 * exercises.ts
 * Config-driven exercise engine definitions.
 * Defines thresholds, key joints, and feedback rules for each movement.
 */

export interface ExerciseConfig {
  key: string;
  name: string;
  primaryJoint: string;
  joints: number[][]; // Landmarks to draw connection (optional)
  downThreshold: number;
  upThreshold: number;
  feedbackRules: {
    condition: (ctx: any) => boolean;
    message: string;
    type: 'warning' | 'error';
  }[];
  demoUrl?: string;
}

export const exercises: Record<string, ExerciseConfig> = {
  squat: {
    key: "squat",
    name: "Bodyweight Squats",
    demoUrl: '/assets/demos/squat.mp4',
    primaryJoint: "knee",
    joints: [[23, 25], [25, 27], [24, 26], [26, 28]],
    downThreshold: 140,
    upThreshold: 160,
    feedbackRules: [
      {
        condition: (ctx: any) => ctx.knee < 70,
        message: "Don't over-bend knees ⚠️",
        type: 'warning'
      },
      {
        condition: (ctx: any) => ctx.hipDepth > 40 && ctx.stage === 'down',
        message: "Drive your hips lower 👇",
        type: 'warning'
      }
    ]
  },

  pushup: {
    key: "pushup",
    name: "Push-Ups",
    demoUrl: '/assets/demos/pushup.mp4',
    primaryJoint: "elbow",
    joints: [[11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 27], [24, 28]],
    downThreshold: 140,
    upThreshold: 155,
    feedbackRules: [
      {
        condition: (ctx: any) => ctx.lateralScore < 70,
        message: "TURN SIDEWAYS 🔄",
        type: 'warning'
      },
      {
        condition: (ctx: any) => ctx.horizontalStretch < 40,
        message: "STRETCH OUT YOUR BODY 📏",
        type: 'warning'
      },
      {
        condition: (ctx: any) => ctx.bodyLine < 135,
        message: "Keep your back straight ❌",
        type: 'error'
      },
      {
        condition: (ctx: any) => ctx.elbow > 105 && ctx.stage === 'down',
        message: "Go lower for full range ⚠️",
        type: 'warning'
      }
    ]
  },

  bicepCurl: {
    key: "bicepCurl",
    name: "Bicep Curls",
    demoUrl: '/assets/demos/bicep_curl.mp4',
    primaryJoint: "elbow",
    joints: [[11, 13], [13, 15], [12, 14], [14, 16]],
    downThreshold: 130,
    upThreshold: 155,
    feedbackRules: [
      {
        condition: (ctx: any) => ctx.elbow > 165 && ctx.stage === 'up',
        message: "Squeeze at the top! ⚡",
        type: 'warning'
      },
      {
        condition: (ctx: any) => ctx.shoulder > 30,
        message: "Keep elbows at side ⚠️",
        type: 'warning'
      }
    ]
  },

  jumpingJack: {
    key: "jumpingJack",
    name: "Jumping Jacks",
    demoUrl: '/assets/demos/jumping_jack.mp4',
    primaryJoint: "shoulder",
    joints: [[12, 24], [11, 23], [14, 12], [13, 11]],
    downThreshold: 60,
    upThreshold: 150,
    feedbackRules: [
      {
        condition: (ctx: any) => ctx.shoulder < 40,
        message: "Raise arms higher ⚠️",
        type: 'warning'
      }
    ]
  },

  plank: {
    key: "plank",
    name: "Plank",
    demoUrl: '/assets/demos/plank.mp4',
    primaryJoint: "bodyLine",
    joints: [[12, 24], [24, 28]],
    downThreshold: 165,
    upThreshold: 180,
    feedbackRules: [
      {
        condition: (ctx: any) => ctx.bodyLine < 160,
        message: "Drop your hips ⚠️",
        type: 'warning'
      },
      {
        condition: (ctx: any) => ctx.bodyLine > 185,
        message: "Hips too high ⚠️",
        type: 'warning'
      }
    ]
  }
};
