import { OcclusionPredictor } from "../services/occlusionPredictor";

const STRIDE = 4;
const LM_COUNT = 33;
const SHARED_HEADER_BYTES = Int32Array.BYTES_PER_ELEMENT;

const predictor = new OcclusionPredictor();

type Landmark = { x: number; y: number; z: number; visibility: number };

interface SharedLandmarkFrame {
  sequence: Int32Array;
  view: Float32Array;
}

let sharedLandmarkFrame: SharedLandmarkFrame | null = null;

function isLandmarkPoint(value: unknown): value is Landmark {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Landmark).x === "number" &&
    typeof (value as Landmark).y === "number"
  );
}

function normalizeSkeleton(landmarks: any[]): Landmark[] {
  return (landmarks || []).filter(isLandmarkPoint).map((landmark) => ({
    x: landmark.x,
    y: landmark.y,
    z: typeof landmark.z === "number" ? landmark.z : 0,
    visibility:
      typeof landmark.visibility === "number" ? landmark.visibility : 0,
  }));
}

function extractSkeletonCandidates(payload: unknown): Landmark[][] | null {
  if (!payload) return null;

  const source = Array.isArray(payload)
    ? payload
    : ((
        payload as {
          candidates?: unknown;
          skeletons?: unknown;
          people?: unknown;
          multiLandmarks?: unknown;
        }
      )?.candidates ??
      (payload as { skeletons?: unknown })?.skeletons ??
      (payload as { people?: unknown })?.people ??
      (payload as { multiLandmarks?: unknown })?.multiLandmarks);

  if (!Array.isArray(source)) return null;
  if (source.length === 0) return [];

  if (Array.isArray(source[0])) {
    return source
      .map((candidate) =>
        normalizeSkeleton(Array.isArray(candidate) ? candidate : []),
      )
      .filter((candidate) => candidate.length > 0);
  }

  if (isLandmarkPoint(source[0])) {
    return [normalizeSkeleton(source)];
  }

  return null;
}

function scoreSkeleton(landmarks: Landmark[]) {
  const visibleLandmarks = landmarks.filter(
    (landmark) => landmark.visibility > 0.25,
  );
  const points = visibleLandmarks.length > 0 ? visibleLandmarks : landmarks;

  if (points.length === 0) {
    return {
      area: 0,
      visibleCount: 0,
      centroidDistance: Number.POSITIVE_INFINITY,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let centroidX = 0;
  let centroidY = 0;

  for (const landmark of points) {
    minX = Math.min(minX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxX = Math.max(maxX, landmark.x);
    maxY = Math.max(maxY, landmark.y);
    centroidX += landmark.x;
    centroidY += landmark.y;
  }

  const width = Math.max(maxX - minX, 0);
  const height = Math.max(maxY - minY, 0);
  const centroid = {
    x: centroidX / points.length,
    y: centroidY / points.length,
  };

  return {
    area: width * height,
    visibleCount: visibleLandmarks.length,
    centroidDistance: Math.hypot(centroid.x - 0.5, centroid.y - 0.5),
  };
}

function selectPrimarySkeleton(candidates: Landmark[][]): Landmark[] | null {
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  let selected = candidates[0];
  let selectedScore = scoreSkeleton(selected);

  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i];
    const candidateScore = scoreSkeleton(candidate);

    if (
      candidateScore.area > selectedScore.area ||
      (candidateScore.area === selectedScore.area &&
        candidateScore.visibleCount > selectedScore.visibleCount) ||
      (candidateScore.area === selectedScore.area &&
        candidateScore.visibleCount === selectedScore.visibleCount &&
        candidateScore.centroidDistance < selectedScore.centroidDistance)
    ) {
      selected = candidate;
      selectedScore = candidateScore;
    }
  }

  return selected;
}

function isolatePrimarySkeleton(payload: unknown): Landmark[] | null {
  const candidates = extractSkeletonCandidates(payload);
  if (candidates) {
    return selectPrimarySkeleton(candidates);
  }

  if (
    Array.isArray(payload) &&
    payload.length > 0 &&
    isLandmarkPoint(payload[0])
  ) {
    return normalizeSkeleton(payload);
  }

  return null;
}

function unpackLandmarks(buf: ArrayBuffer) {
  const view = new Float32Array(buf);
  const out: Landmark[] = [];
  for (let i = 0; i < LM_COUNT; i++) {
    const o = i * STRIDE;
    out.push({
      x: view[o],
      y: view[o + 1],
      z: view[o + 2],
      visibility: view[o + 3],
    });
  }
  return out;
}

function initSharedLandmarks(buffer: SharedArrayBuffer | ArrayBuffer) {
  if (buffer instanceof SharedArrayBuffer) {
    sharedLandmarkFrame = {
      sequence: new Int32Array(buffer, 0, 1),
      view: new Float32Array(buffer, SHARED_HEADER_BYTES, LM_COUNT * STRIDE),
    };
    return;
  }

  sharedLandmarkFrame = null;
}

function readSharedLandmarks(): Landmark[] | null {
  if (!sharedLandmarkFrame) return null;

  for (;;) {
    const startSequence = Atomics.load(sharedLandmarkFrame.sequence, 0);
    if (startSequence === 0 || (startSequence & 1) === 1) {
      return null;
    }

    const out: Landmark[] = [];
    for (let i = 0; i < LM_COUNT; i++) {
      const o = i * STRIDE;
      out.push({
        x: sharedLandmarkFrame.view[o],
        y: sharedLandmarkFrame.view[o + 1],
        z: sharedLandmarkFrame.view[o + 2],
        visibility: sharedLandmarkFrame.view[o + 3],
      });
    }

    const endSequence = Atomics.load(sharedLandmarkFrame.sequence, 0);
    if (startSequence === endSequence && (endSequence & 1) === 0) {
      return out;
    }
  }
}

function calculateAngle(
  a: { x: number; y: number; z?: number },
  b: { x: number; y: number; z?: number },
  c: { x: number; y: number; z?: number },
): number {
  if (!a || !b || !c) return 0;
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360.0 - angle;
  return Math.round(angle);
}

function getBestSide(landmarks: any[]): "left" | "right" {
  const leftIndices = [11, 13, 15, 23, 25, 27];
  const rightIndices = [12, 14, 16, 24, 26, 28];
  const leftVis =
    leftIndices.reduce((s, i) => s + (landmarks[i]?.visibility || 0), 0) / 6;
  const rightVis =
    rightIndices.reduce((s, i) => s + (landmarks[i]?.visibility || 0), 0) / 6;
  return leftVis >= rightVis ? "left" : "right";
}

function computeAngles(landmarks: any[]): Record<string, number> {
  if (!landmarks || landmarks.length < 29) return {};
  const side = getBestSide(landmarks);
  const ids =
    side === "left"
      ? { s: 11, e: 13, w: 15, h: 23, k: 25, a: 27 }
      : { s: 12, e: 14, w: 16, h: 24, k: 26, a: 28 };

  const shoulder = landmarks[ids.s];
  const hip = landmarks[ids.h];
  const ankle = landmarks[ids.a];
  const totalHeight = Math.abs((ankle?.y || 0) - (shoulder?.y || 0)) || 1;

  // Lunge specific calculations
  const leftKneeAngle = calculateAngle(
    landmarks[23],
    landmarks[25],
    landmarks[27],
  );
  const rightKneeAngle = calculateAngle(
    landmarks[24],
    landmarks[26],
    landmarks[28],
  );
  const activeSideLunge = leftKneeAngle < rightKneeAngle ? "left" : "right";
  const activeKneeIdx = activeSideLunge === "left" ? 25 : 26;
  const activeToeIdx = activeSideLunge === "left" ? 31 : 32;
  const activeHeelIdx = activeSideLunge === "left" ? 29 : 30;

  let kneePastToes = 0;
  const aKnee = landmarks[activeKneeIdx];
  const aToe = landmarks[activeToeIdx];
  const aHeel = landmarks[activeHeelIdx];
  if (aKnee && aToe && aHeel) {
    const footX = aToe.x - aHeel.x;
    const kneeX = aKnee.x - aHeel.x;
    const footZ = (aToe.z || 0) - (aHeel.z || 0);
    const kneeZ = (aKnee.z || 0) - (aHeel.z || 0);

    if (Math.abs(footX) > Math.abs(footZ)) {
      if (Math.abs(footX) > 0.02 && kneeX / footX > 1.05) kneePastToes = 1;
    } else {
      if (Math.abs(footZ) > 0.02 && kneeZ / footZ > 1.05) kneePastToes = 1;
    }
  }

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
    hipDepth: Math.round(
      (((ankle?.y || 0) - (hip?.y || 0)) / totalHeight) * 100,
    ),
  };
}

function detectExercise(landmarks: any[], angles: Record<string, number>) {
  if (!landmarks || landmarks.length < 29)
    return { label: "unknown", confidence: 0 };

  const { knee, elbow, shoulder, hipDepth, lungeKnee, backKnee } = angles;

  if (knee < 140 && hipDepth < 60) return { label: "squat", confidence: 0.9 };
  if (elbow < 80 && shoulder < 30)
    return { label: "bicepCurl", confidence: 0.85 };

  const lShoulder = landmarks[11];
  const lHip = landmarks[23];
  const lAnkle = landmarks[27];
  if (lShoulder && lHip && lAnkle) {
    const hStretch = Math.abs(lAnkle.x - lShoulder.x);
    const vCompact = Math.abs(lAnkle.y - lShoulder.y);
    if (hStretch > vCompact * 0.8) {
      if (elbow < 120) return { label: "pushup", confidence: 0.85 };
      return { label: "plank", confidence: 0.8 };
    }
  }

  if (shoulder > 60) return { label: "jumpingJack", confidence: 0.75 };
  return { label: "unknown", confidence: 0.4 };
}

let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
let scanY = 0;
let scanDirection = 1;

function drawSkeleton(
  landmarks: any[],
  status: string,
  primaryJoints: number[],
  wasOccluded?: boolean[],
) {
  if (!offscreenCtx) return;
  const ctx = offscreenCtx;
  const { width, height } = ctx.canvas;

  ctx.clearRect(0, 0, width, height);

  const color =
    status === "green"
      ? "#00ff88"
      : status === "yellow"
        ? "#ffd600"
        : "#ff3b5c";

  scanY += 3 * scanDirection;
  if (scanY > height || scanY < 0) scanDirection *= -1;
  ctx.beginPath();
  ctx.moveTo(0, scanY);
  ctx.lineTo(width, scanY);
  ctx.strokeStyle = "rgba(0, 240, 255, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const connections = [
    [11, 12],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [11, 23],
    [12, 24],
    [23, 24],
    [23, 25],
    [25, 27],
    [24, 26],
    [26, 28],
  ];

  const basePath = new Path2D();
  const highlightPath = new Path2D();
  const predictedPath = new Path2D();

  for (const [i, j] of connections) {
    const a = landmarks[i];
    const b = landmarks[j];
    if (a && b && a.visibility > 0.5 && b.visibility > 0.5) {
      const occluded = wasOccluded ? wasOccluded[i] || wasOccluded[j] : false;
      const isPrimary = primaryJoints.includes(i) || primaryJoints.includes(j);
      const p = occluded ? predictedPath : isPrimary ? highlightPath : basePath;
      p.moveTo(a.x * width, a.y * height);
      p.lineTo(b.x * width, b.y * height);
    }
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.stroke(basePath);

  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke(highlightPath);

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 200, 0, 0.6)";
  ctx.setLineDash([6, 4]);
  ctx.stroke(predictedPath);
  ctx.setLineDash([]);

  landmarks.forEach((lm, i) => {
    if (lm.visibility > 0.5) {
      const isPrimary = primaryJoints.includes(i);
      const isPredicted = wasOccluded ? wasOccluded[i] : false;
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, isPrimary ? 6 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isPredicted
        ? "rgba(255, 200, 0, 0.8)"
        : isPrimary
          ? color
          : "rgba(255, 255, 255, 0.5)";
      ctx.fill();
    }
  });
}

self.onmessage = (event: MessageEvent) => {
  const {
    type,
    canvas,
    buf,
    sharedBuffer,
    landmarks: rawLandmarks,
    status,
    primaryJoints,
    frameId,
    t0,
  } = event.data;

  if (type === "initCanvas") {
    offscreenCtx = canvas.getContext("2d");
    return;
  }

  if (type === "initSharedBuffer") {
    initSharedLandmarks(sharedBuffer);
    return;
  }

  if (type === "resetPredictor") {
    predictor.reset();
    return;
  }

  const landmarks =
    isolatePrimarySkeleton(rawLandmarks) ??
    (buf ? unpackLandmarks(buf) : readSharedLandmarks());

  if (!landmarks || landmarks.length === 0) {
    const msg: any = {
      frameId,
      angles: {},
      detectedExercise: "unknown",
      confidence: 0,
    };
    if (buf) {
      (self as any).postMessage(msg, [buf]);
    } else {
      (self as any).postMessage(msg);
    }
    return;
  }

  const predicted = predictor.predict(landmarks);
  const correctedLandmarks = predicted.landmarks;

  if (offscreenCtx)
    drawSkeleton(
      correctedLandmarks,
      status || "green",
      primaryJoints || [],
      predicted.wasOccluded,
    );

  const angles = computeAngles(correctedLandmarks);
  const { label: detectedExercise, confidence } = detectExercise(
    correctedLandmarks,
    angles,
  );

  const ipcMs = t0 != null ? performance.now() - t0 : undefined;

  const reply: any = {
    frameId,
    angles,
    detectedExercise,
    confidence,
    ipcMs,
    occlusionConfidence: predicted.confidence,
    wasOccluded: predicted.wasOccluded,
  };
  if (buf) {
    reply.buf = buf;
    (self as any).postMessage(reply, [buf]);
  } else {
    (self as any).postMessage(reply);
  }
};
