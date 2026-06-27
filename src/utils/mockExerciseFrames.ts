import { ReplayFrame } from "../components/Replay3DModel";

const BASE_POSE = Array.from({ length: 33 }).map((_, i) => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));

// Override key points for a standing pose
const setupStanding = () => {
  const pose = [...BASE_POSE].map(p => ({ ...p }));
  // Shoulders (11, 12)
  pose[11] = { x: 0.6, y: 0.3, z: 0, visibility: 0.9 };
  pose[12] = { x: 0.4, y: 0.3, z: 0, visibility: 0.9 };
  // Hips (23, 24)
  pose[23] = { x: 0.55, y: 0.5, z: 0, visibility: 0.9 };
  pose[24] = { x: 0.45, y: 0.5, z: 0, visibility: 0.9 };
  // Knees (25, 26)
  pose[25] = { x: 0.55, y: 0.7, z: 0, visibility: 0.9 };
  pose[26] = { x: 0.45, y: 0.7, z: 0, visibility: 0.9 };
  // Ankles (27, 28)
  pose[27] = { x: 0.55, y: 0.9, z: 0, visibility: 0.9 };
  pose[28] = { x: 0.45, y: 0.9, z: 0, visibility: 0.9 };
  // Elbows (13, 14)
  pose[13] = { x: 0.65, y: 0.4, z: 0, visibility: 0.9 };
  pose[14] = { x: 0.35, y: 0.4, z: 0, visibility: 0.9 };
  // Wrists (15, 16)
  pose[15] = { x: 0.7, y: 0.5, z: 0, visibility: 0.9 };
  pose[16] = { x: 0.3, y: 0.5, z: 0, visibility: 0.9 };
  // Head / Nose (0)
  pose[0] = { x: 0.5, y: 0.15, z: -0.1, visibility: 0.9 };
  return pose;
};

export const generateSquatFrames = (numFrames = 60): ReplayFrame[] => {
  const frames: ReplayFrame[] = [];
  for (let i = 0; i < numFrames; i++) {
    const phase = Math.sin((i / numFrames) * Math.PI * 2);
    // mapped to 0 to 1 (0 = standing, 1 = squatting)
    const squatDepth = (Math.sin((i / numFrames) * Math.PI * 2 - Math.PI / 2) + 1) / 2;

    const pose = setupStanding();
    // Lower hips
    pose[23].y += squatDepth * 0.15;
    pose[24].y += squatDepth * 0.15;
    pose[23].z -= squatDepth * 0.1;
    pose[24].z -= squatDepth * 0.1;
    // Knees push forward (Z) and slightly down
    pose[25].z -= squatDepth * 0.2;
    pose[26].z -= squatDepth * 0.2;
    pose[25].y += squatDepth * 0.05;
    pose[26].y += squatDepth * 0.05;
    // Lower head/shoulders by same amount as hips
    pose[0].y += squatDepth * 0.15;
    pose[11].y += squatDepth * 0.15;
    pose[12].y += squatDepth * 0.15;
    // Bring hands together in front
    pose[15].x = 0.5 + squatDepth * 0.05;
    pose[16].x = 0.5 - squatDepth * 0.05;
    pose[15].y = 0.4 + squatDepth * 0.1;
    pose[16].y = 0.4 + squatDepth * 0.1;

    frames.push({
      timestamp: i * 33, // approx 30fps
      landmarks: pose,
      feedback: squatDepth > 0.8 ? "Good depth!" : "Keep going...",
      exercise: "squat"
    });
  }
  return frames;
};

export const generateJumpingJackFrames = (numFrames = 60): ReplayFrame[] => {
  const frames: ReplayFrame[] = [];
  for (let i = 0; i < numFrames; i++) {
    const jumpPhase = (Math.sin((i / numFrames) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    const pose = setupStanding();
    
    // Legs spread
    pose[27].x += jumpPhase * 0.1;
    pose[28].x -= jumpPhase * 0.1;
    pose[25].x += jumpPhase * 0.05;
    pose[26].x -= jumpPhase * 0.05;
    
    // Arms go up
    pose[15].y -= jumpPhase * 0.4;
    pose[16].y -= jumpPhase * 0.4;
    pose[15].x -= jumpPhase * 0.1; // move inwards above head
    pose[16].x += jumpPhase * 0.1;
    
    pose[13].y -= jumpPhase * 0.2;
    pose[14].y -= jumpPhase * 0.2;

    frames.push({
      timestamp: i * 33,
      landmarks: pose,
      feedback: jumpPhase > 0.8 ? "Arms fully extended!" : "Keep moving...",
      exercise: "jumping_jacks"
    });
  }
  return frames;
};

export const getExerciseFrames = (exercise: string): ReplayFrame[] => {
  switch (exercise.toLowerCase()) {
    case "squat":
      return generateSquatFrames();
    case "jumping jacks":
    case "jumping_jacks":
      return generateJumpingJackFrames();
    default:
      return generateSquatFrames(); // Default fallback
  }
};
