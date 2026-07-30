export interface SafeTelemetryData {
  exerciseKey: string;
  repCount: number;
  durationSecs: number;
  caloriesBurned: number;
  accuracyScore: number;
  timestamp: number;
  deviceType?: string;
}

/**
 * Sanitize telemetry data payloads to guarantee NO raw video frames, base64 images,
 * canvas ImageData, or personal identifiers are ever transmitted to external servers.
 */
export function sanitizeTelemetryPayload(rawInput: Record<string, any>): SafeTelemetryData {
  const safeData: SafeTelemetryData = {
    exerciseKey: String(rawInput.exerciseKey || rawInput.exercise || 'unknown'),
    repCount: Math.max(0, Number(rawInput.repCount || rawInput.reps || 0)),
    durationSecs: Math.max(0, Number(rawInput.durationSecs || rawInput.duration || 0)),
    caloriesBurned: Math.max(0, Number(rawInput.caloriesBurned || rawInput.calories || 0)),
    accuracyScore: Math.min(100, Math.max(0, Number(rawInput.accuracyScore || rawInput.accuracy || 100))),
    timestamp: Number(rawInput.timestamp || Date.now()),
    deviceType: typeof rawInput.deviceType === 'string' ? rawInput.deviceType : undefined,
  };

  // Explicitly audit keys to reject any forbidden image/blob data fields
  const forbiddenPatterns = ['image', 'frame', 'video', 'canvas', 'base64', 'blob', 'imageData', 'snapshot'];
  for (const key of Object.keys(rawInput)) {
    const lowerKey = key.toLowerCase();
    if (forbiddenPatterns.some((pattern) => lowerKey.includes(pattern))) {
      console.warn(`[Security Audit] Stripped potential sensitive video payload key "${key}" from telemetry.`);
    }
  }

  return safeData;
}
