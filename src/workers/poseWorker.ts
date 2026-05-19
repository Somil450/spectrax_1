/**
 * poseWorker.ts
 * Web Worker: angle computation + skeletal rendering off the main thread.
 * Accepts packed Float32Array landmarks (zero-copy transfer) or plain objects.
 */

const STRIDE = 4;
const LM_COUNT = 33;

function unpackLandmarks(buf: ArrayBuffer) {
  const view = new Float32Array(buf);
  const out: Array<{ x: number; y: number; z: number; visibility: number }> = [];
  for (let i = 0; i < LM_COUNT; i++) {
    const o = i * STRIDE;
    out.push({ x: view[o], y: view[o + 1], z: view[o + 2], visibility: view[o + 3] });
  }
  return out;
}

// ─── Angle math ────────────────────────────────────────────────────────────────
function calculateAngle(
  a: { x: number; y: number; z?: number },
  b: { x: number; y: number; z?: number },
  c: { x: number; y: number; z?: number }
): number {
  if (!a || !b || !c) return 0;
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360.0 - angle;
  return Math.round(angle);
}

function getBestSide(landmarks: any[]): 'left' | 'right' {
  const leftIndices  = [11, 13, 15, 23, 25, 27];
  const rightIndices = [12, 14, 16, 24, 26, 28];
  const leftVis  = leftIndices.reduce((s, i) => s + (landmarks[i]?.visibility || 0), 0) / 6;
  const rightVis = rightIndices.reduce((s, i) => s + (landmarks[i]?.visibility || 0), 0) / 6;
  return leftVis >= rightVis ? 'left' : 'right';
}

function computeAngles(landmarks: any[]): Record<string, number> {
  if (!landmarks || landmarks.length < 29) return {};
  const side = getBestSide(landmarks);
  const ids = side === 'left'
    ? { s: 11, e: 13, w: 15, h: 23, k: 25, a: 27 }
    : { s: 12, e: 14, w: 16, h: 24, k: 26, a: 28 };

  const shoulder = landmarks[ids.s];
  const hip      = landmarks[ids.h];
  const ankle    = landmarks[ids.a];
  const totalHeight = Math.abs((ankle?.y || 0) - (shoulder?.y || 0)) || 1;

  return {
    knee:     calculateAngle(landmarks[ids.h], landmarks[ids.k], landmarks[ids.a]),
    elbow:    calculateAngle(landmarks[ids.s], landmarks[ids.e], landmarks[ids.w]),
    shoulder: calculateAngle(landmarks[ids.e], landmarks[ids.s], landmarks[ids.h]),
    bodyLine: calculateAngle(landmarks[ids.s], landmarks[ids.h], landmarks[ids.a]),
    hipDepth: Math.round(((ankle?.y || 0) - (hip?.y || 0)) / totalHeight * 100),
  };
}

// ─── Exercise detection ───────────────────────────────────────────────────────
function detectExercise(landmarks: any[], angles: Record<string, number>) {
  if (!landmarks || landmarks.length < 29) return { label: 'unknown', confidence: 0 };

  const { knee, elbow, shoulder, hipDepth } = angles;

  if (knee < 140 && hipDepth < 60) return { label: 'squat', confidence: 0.9 };
  if (elbow < 80 && shoulder < 30) return { label: 'bicepCurl', confidence: 0.85 };

  const lShoulder = landmarks[11];
  const lHip      = landmarks[23];
  const lAnkle    = landmarks[27];
  if (lShoulder && lHip && lAnkle) {
    const hStretch = Math.abs(lAnkle.x - lShoulder.x);
    const vCompact = Math.abs(lAnkle.y - lShoulder.y);
    if (hStretch > vCompact * 0.8) {
      if (elbow < 120) return { label: 'pushup', confidence: 0.85 };
      return { label: 'plank', confidence: 0.8 };
    }
  }

  if (shoulder > 60) return { label: 'jumpingJack', confidence: 0.75 };
  return { label: 'unknown', confidence: 0.4 };
}

// ─── OffscreenCanvas ──────────────────────────────────────────────────────────
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
let scanY = 0;
let scanDirection = 1;

function drawSkeleton(landmarks: any[], status: string, primaryJoints: number[]) {
  if (!offscreenCtx) return;
  const ctx = offscreenCtx;
  const { width, height } = ctx.canvas;

  ctx.clearRect(0, 0, width, height);

  const color = status === 'green' ? '#00ff88' : (status === 'yellow' ? '#ffd600' : '#ff3b5c');

  scanY += 3 * scanDirection;
  if (scanY > height || scanY < 0) scanDirection *= -1;
  ctx.beginPath();
  ctx.moveTo(0, scanY);
  ctx.lineTo(width, scanY);
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const connections = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27], [24, 26], [26, 28],
  ];

  const basePath      = new Path2D();
  const highlightPath = new Path2D();

  for (const [i, j] of connections) {
    const a = landmarks[i];
    const b = landmarks[j];
    if (a && b && a.visibility > 0.5 && b.visibility > 0.5) {
      const isPrimary = primaryJoints.includes(i) || primaryJoints.includes(j);
      const p = isPrimary ? highlightPath : basePath;
      p.moveTo(a.x * width, a.y * height);
      p.lineTo(b.x * width, b.y * height);
    }
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.stroke(basePath);

  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke(highlightPath);

  landmarks.forEach((lm, i) => {
    if (lm.visibility > 0.5) {
      const isPrimary = primaryJoints.includes(i);
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, isPrimary ? 6 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isPrimary ? color : 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
    }
  });
}

// ─── Message handler ──────────────────────────────────────────────────────────
self.onmessage = (event: MessageEvent) => {
  const { type, canvas, buf, landmarks: rawLandmarks, status, primaryJoints, frameId, t0 } = event.data;

  if (type === 'initCanvas') {
    offscreenCtx = canvas.getContext('2d');
    return;
  }

  // Prefer zero-copy packed buffer; fall back to plain objects
  const landmarks = buf ? unpackLandmarks(buf) : rawLandmarks;

  if (!landmarks || landmarks.length === 0) {
    const msg: any = { frameId, angles: {}, detectedExercise: 'unknown', confidence: 0 };
    if (buf) { msg.buf = buf; self.postMessage(msg, [buf]); }
    else { self.postMessage(msg); }
    return;
  }

  if (offscreenCtx) drawSkeleton(landmarks, status || 'green', primaryJoints || []);

  const angles = computeAngles(landmarks);
  const { label: detectedExercise, confidence } = detectExercise(landmarks, angles);

  // Measure IPC round-trip so callers can assert < 0.5 ms
  const ipcMs = t0 != null ? performance.now() - t0 : undefined;

  const reply: any = { frameId, angles, detectedExercise, confidence, ipcMs };
  // Return the buffer to main thread — keeps the pool alive without allocation
  if (buf) {
    reply.buf = buf;
    self.postMessage(reply, [buf]);
  } else {
    self.postMessage(reply);
  }
};
