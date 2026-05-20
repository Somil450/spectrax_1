/**
 * poseWorker.ts
 * Web Worker: runs angle computation + skeletal sense off the main thread.
 * Main thread posts: { landmarks, exercise }
 * Worker posts back: { angles, detectedExercise, confidence }
 *
 * NOTE: Workers cannot import browser APIs or DOM services.
 * All logic here is pure math — no imports from services that touch the DOM.
 */

// ─── Inline angle math (mirror of angleUtils — no DOM imports allowed in worker) ─
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
  const hip = landmarks[ids.h];
  const ankle = landmarks[ids.a];
  const totalHeight = Math.abs((ankle?.y || 0) - (shoulder?.y || 0)) || 1;

  return {
    knee:      calculateAngle(landmarks[ids.h], landmarks[ids.k], landmarks[ids.a]),
    elbow:     calculateAngle(landmarks[ids.s], landmarks[ids.e], landmarks[ids.w]),
    shoulder:  calculateAngle(landmarks[ids.e], landmarks[ids.s], landmarks[ids.h]),
    bodyLine:  calculateAngle(landmarks[ids.s], landmarks[ids.h], landmarks[ids.a]),
    hipDepth:  Math.round(((ankle?.y || 0) - (hip?.y || 0)) / totalHeight * 100),
  };
}

// ─── Lightweight exercise detection (geometry-based, no ML) ───────────────────
function detectExercise(landmarks: any[], angles: Record<string, number>): {
  label: string;
  confidence: number;
} {
  if (!landmarks || landmarks.length < 29) return { label: 'unknown', confidence: 0 };

  const { knee, elbow, shoulder, hipDepth } = angles;

  // Squat: knees bent, hips low
  if (knee < 140 && hipDepth < 60) return { label: 'squat', confidence: 0.9 };

  // Bicep curl: elbow very bent, shoulder near neutral
  if (elbow < 80 && shoulder < 30) return { label: 'bicepCurl', confidence: 0.85 };

  // Pushup/Plank: horizontal body (shoulders and hips roughly same height)
  const lShoulder = landmarks[11];
  const lHip = landmarks[23];
  const lAnkle = landmarks[27];
  if (lShoulder && lHip && lAnkle) {
    const horizontalStretch = Math.abs(lAnkle.x - lShoulder.x);
    const verticalCompact = Math.abs(lAnkle.y - lShoulder.y);
    if (horizontalStretch > verticalCompact * 0.8) {
      if (elbow < 120) return { label: 'pushup', confidence: 0.85 };
      return { label: 'plank', confidence: 0.8 };
    }
  }

  // Jumping Jack: arms raised (shoulder angle wide)
  if (shoulder > 60) return { label: 'jumpingJack', confidence: 0.75 };

  return { label: 'unknown', confidence: 0.4 };
}

// ─── OffscreenCanvas Rendering Logic ────────────────────────────────────────
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
let scanY = 0;
let scanDirection = 1;

function drawSkeleton(landmarks: any[], status: string, primaryJoints: number[]) {
  if (!offscreenCtx) return;
  const ctx = offscreenCtx;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Clear
  ctx.clearRect(0, 0, width, height);

  // Status colors
  const color = status === 'green' ? '#00ff88' : (status === 'yellow' ? '#ffd600' : '#ff3b5c');
  
  // 1. Draw Scanning Line
  scanY += 3 * scanDirection;
  if (scanY > height || scanY < 0) scanDirection *= -1;
  ctx.beginPath();
  ctx.moveTo(0, scanY);
  ctx.lineTo(width, scanY);
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 2. Draw Connections
  const connections = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Upper
    [11, 23], [12, 24], [23, 24], // Torso
    [23, 25], [25, 27], [24, 26], [26, 28], // Lower
  ];

  const baseLinePath = new Path2D();
  const highlightPath = new Path2D();

  connections.forEach(([i, j]) => {
    const a = landmarks[i];
    const b = landmarks[j];
    if (a && b && a.visibility > 0.5 && b.visibility > 0.5) {
      const isPrimary = primaryJoints.includes(i) || primaryJoints.includes(j);
      const targetPath = isPrimary ? highlightPath : baseLinePath;
      targetPath.moveTo(a.x * width, a.y * height);
      targetPath.lineTo(b.x * width, b.y * height);
    }
  });

  // Stroke background connections
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.stroke(baseLinePath);

  // Stroke primary connections
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke(highlightPath);

  // 3. Draw Landmarks
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
  const { type, canvas, landmarks, status, primaryJoints, frameId } = event.data;

  if (type === 'initCanvas') {
    offscreenCtx = canvas.getContext('2d');
    console.log("[PoseWorker] OffscreenCanvas initialized.");
    return;
  }

  if (!landmarks || landmarks.length === 0) {
    self.postMessage({ frameId, angles: {}, detectedExercise: 'unknown', confidence: 0 });
    return;
  }

  // Draw if canvas is available
  if (offscreenCtx) {
    drawSkeleton(landmarks, status || 'green', primaryJoints || []);
  }

  const angles = computeAngles(landmarks);
  const { label: detectedExercise, confidence } = detectExercise(landmarks, angles);

  self.postMessage({ frameId, angles, detectedExercise, confidence });
};

