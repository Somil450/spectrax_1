export interface BicepCurlArmState {
  currentAngle: number;
  maxCurlAngle: number;
  repCount: number;
  totalSupinationScore: number;
}

export interface BicepCurlSideReport {
  side: "left" | "right";
  totalReps: number;
  avgSupinationScore: number;
}

export function initialBicepCurlArmState(): BicepCurlArmState {
  return {
    currentAngle: 180,
    maxCurlAngle: 180,
    repCount: 0,
    totalSupinationScore: 0,
  };
}

export function computeElbowAngle(
  shoulder: { x: number; y: number },
  elbow: { x: number; y: number },
  wrist: { x: number; y: number },
): number {
  const a = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
  const b = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };
  const dot = a.x * b.x + a.y * b.y;
  const magA = Math.sqrt(a.x * a.x + a.y * a.y);
  const magB = Math.sqrt(b.x * b.x + b.y * b.y);
  if (magA < 1e-6 || magB < 1e-6) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return Math.acos(cos) * (180 / Math.PI);
}

export function detectActiveSide(
  leftAngle: number,
  rightAngle: number,
  thresholdDelta = 15,
): "left" | "right" | "both" | "none" {
  const leftDiff = Math.abs(leftAngle - 180);
  const rightDiff = Math.abs(rightAngle - 180);
  if (leftDiff > thresholdDelta && rightDiff > thresholdDelta) return "both";
  if (leftDiff > thresholdDelta) return "left";
  if (rightDiff > thresholdDelta) return "right";
  return "none";
}

export function getBicepCurlLiveFeedback(
  activeSide: "left" | "right" | "both" | "none",
  currentAngle: number,
): string | undefined {
  if (activeSide === "none") return undefined;
  if (currentAngle > 160) return "Lower the weight slowly";
  if (currentAngle < 50) return "Squeeze at the top";
  return undefined;
}
