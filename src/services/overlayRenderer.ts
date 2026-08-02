import type { Results } from "@mediapipe/pose";

import type { Mesh3DVertex } from "../types/pose";

// Standard MediaPipe 33-landmark pose connections
export const POSE_CONNECTIONS_33: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], [11, 23], [12, 24],
  [23, 24], [23, 25], [25, 27], [27, 29], [29, 31], [24, 26], [26, 28], [28, 30], [30, 32],
];

export const SMOOTHING_ALPHA = 0.45;
export const VISIBILITY_HOLD_THRESHOLD = 0.3;
export const PULSE_PERIOD_MS = 1600;
export const SCAN_LINE_SPEED = 0.06;

type LandmarkLike = {
  x?: number;
  y?: number;
  z?: number;
  visibility?: number;
};

/**
 * Smooths landmark positions with exponential moving average (EMA) so the
 * skeleton glides instead of jumping between frames. Joints with very low
 * visibility are damped harder (kept near their previous spot) to avoid
 * snapping to interpolated outliers.
 */
export function smoothLandmarks(
  previous: Array<LandmarkLike | null> | null,
  next: Array<LandmarkLike | null>,
  alpha = SMOOTHING_ALPHA,
): Array<LandmarkLike | null> {
  if (!next) return [];
  if (!previous || previous.length !== next.length) return next as any[];

  const out: Array<LandmarkLike | null> = [];
  for (let i = 0; i < next.length; i++) {
    const n = next[i];
    const p = previous[i];
    if (!n) {
      out.push(p ?? null);
      continue;
    }
    if (!p || typeof n.x !== "number" || typeof n.y !== "number") {
      out.push({ ...n });
      continue;
    }

    const dampened =
      typeof n.visibility === "number" && n.visibility < VISIBILITY_HOLD_THRESHOLD
        ? alpha * 0.25
        : alpha;

    out.push({
      x: p.x! + (n.x - p.x!) * dampened,
      y: p.y! + (n.y - p.y!) * dampened,
      z:
        typeof n.z === "number" && typeof p.z === "number"
          ? p.z + (n.z - p.z) * dampened
          : n.z ?? p.z,
      visibility: n.visibility ?? p.visibility,
    });
  }
  return out;
}

/**
 * Cosine pulse in [0, 1] used for joint glow/halo animations.
 */
export function pulsePhase(now: number, period = PULSE_PERIOD_MS): number {
  return (Math.cos(((now % period) / period) * Math.PI * 2) + 1) / 2;
}

/**
 * Triangle-wave scan line position in [0, height] driven by elapsed time,
 * so the scan animation stays smooth regardless of the draw call rate.
 */
export function scanLineY(
  height: number,
  now: number,
  speed = SCAN_LINE_SPEED,
): number {
  if (height <= 0) return 0;
  const t = now * speed;
  return Math.abs(((t + height) % (2 * height)) - height);
}

export class OverlayRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private draw3DEnabled = false;
  private meshVertices: Mesh3DVertex[] | null = null;
  private smoothingBuffer: Array<LandmarkLike | null> | null = null;

  setContext(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.resetSmoothing();
  }

  /** Clears per-session visual state (smoothing history). */
  resetSmoothing() {
    this.smoothingBuffer = null;
  }

  set3DEnabled(enabled: boolean) {
    this.draw3DEnabled = enabled;
  }

  setMeshVertices(vertices: Mesh3DVertex[] | null) {
    this.meshVertices = vertices;
  }

  clear() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  private getStatusColor(status: "green" | "yellow" | "red") {
    switch (status) {
      case "green": return "#00ff88";
      case "yellow": return "#ffd600";
      case "red": return "#ff3b5c";
      default: return "#00f0ff";
    }
  }

  draw(
    results: Results,
    status: "green" | "yellow" | "red" = "green",
    primaryJoints: number[] = [],
    errorJoints: number[] = []
  ) {
    if (!this.ctx || !results.poseLandmarks) return;

    this.clear();

    const color = this.getStatusColor(status);
    const width = this.ctx.canvas.width;
    const height = this.ctx.canvas.height;
    const now = performance.now();
    const pulse = pulsePhase(now);

    // Smooth landmark movement
    this.smoothingBuffer = smoothLandmarks(
      this.smoothingBuffer,
      results.poseLandmarks,
    );
    const smoothed = this.smoothingBuffer as any[];

    if (this.draw3DEnabled && this.meshVertices) {
      this.draw3DMesh(this.meshVertices, width, height, color);
    }

    this.drawSkeleton(smoothed, color, primaryJoints, errorJoints, pulse, width, height);

    this.drawScanLine(height, now);
    this.drawCenterOfMass(smoothed);
  }

  private strokeConnections(
    landmarks: any[],
    width: number,
    height: number,
    strokeStyle: string,
    lineWidth: number,
    connections: Array<[number, number]>,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.beginPath();
    for (const [i, j] of connections) {
      const a = landmarks[i];
      const b = landmarks[j];
      if (a && b && a.visibility >= VISIBILITY_HOLD_THRESHOLD && b.visibility >= VISIBILITY_HOLD_THRESHOLD) {
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
      }
    }
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  /**
   * Draws the skeleton natively: dim base connectors, glowing status-colored
   * connectors, and joints with pulsing glow halos on primary/error joints.
   */
  private drawSkeleton(
    landmarks: any[],
    color: string,
    primaryJoints: number[],
    errorJoints: number[],
    pulse: number,
    width: number,
    height: number,
  ) {
    const ctx = this.ctx;
    if (!ctx || !landmarks) return;

    // 1) Dim base connectors (subtle silhouette)
    this.strokeConnections(
      landmarks, width, height,
      "rgba(255,255,255,0.15)", 2, POSE_CONNECTIONS_33,
    );

    // 2) Glowing status-colored connectors
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    this.strokeConnections(
      landmarks, width, height,
      color, 4, POSE_CONNECTIONS_33,
    );
    ctx.restore();

    // 3) Joints with glow/pulse effects
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (!lm || typeof lm.x !== "number" || lm.visibility < VISIBILITY_HOLD_THRESHOLD) continue;

      const px = lm.x * width;
      const py = lm.y * height;
      const isError = errorJoints.includes(i);
      const isPrimary = primaryJoints.includes(i);

      if (isError || isPrimary) {
        // Pulsing glow halo
        const haloRadius = (isError ? 13 : 11) + pulse * 7;
        const glowColor = isError ? "#ff3b5c" : color;
        const halo = ctx.createRadialGradient(px, py, 1, px, py, haloRadius);
        halo.addColorStop(0, glowColor + "99");
        halo.addColorStop(1, glowColor + "00");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(px, py, haloRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(px, py, isError ? 7 : isPrimary ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isError ? "#ff3b5c" : isPrimary ? color : "rgba(0,240,255,0.85)";
      ctx.fill();
      if (isPrimary) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  private draw3DMesh(
    vertices: Mesh3DVertex[],
    canvasWidth: number,
    canvasHeight: number,
    color: string
  ) {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const focalLength = canvasWidth;

    const projected: { x: number; y: number; visible: boolean }[] = [];
    for (const v of vertices) {
      if (v.z > 0.01 && v.visibility > 0.5) {
        const scale = focalLength / (v.z * 1000);
        const px = canvasWidth / 2 + v.x * scale;
        const py = canvasHeight / 2 + v.y * scale;
        projected.push({ x: px, y: py, visible: true });
      } else {
        projected.push({ x: 0, y: 0, visible: false });
      }
    }

    const connections3D = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
      [24, 26], [26, 28], [27, 29], [29, 31], [28, 30], [30, 32],
    ];

    ctx.save();
    ctx.strokeStyle = color + "66";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    for (const [i, j] of connections3D) {
      const a = projected[i];
      const b = projected[j];
      if (a?.visible && b?.visible) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    ctx.fillStyle = color + "AA";
    for (const p of projected) {
      if (p.visible) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Animated scan line driven by elapsed time with a glowing fade-out gradient.
   */
  private drawScanLine(height: number, now: number) {
    if (!this.ctx) return;
    const canvas = this.ctx.canvas;
    const y = scanLineY(height, now);

    const grad = this.ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, "rgba(0,240,255,0)");
    grad.addColorStop(0.5, "rgba(0,240,255,0.55)");
    grad.addColorStop(1, "rgba(0,240,255,0)");

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(0, y);
    this.ctx.lineTo(canvas.width, y);
    this.ctx.strokeStyle = grad;
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = "rgba(0,240,255,0.8)";
    this.ctx.shadowBlur = 8;
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawCenterOfMass(landmarks: any[]) {
    if (!this.ctx || !landmarks || landmarks.length < 29) return;

    const width = this.ctx.canvas.width;
    const height = this.ctx.canvas.height;

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return;

    const comX = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
    const comY = (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4;

    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const baseOfSupportX = (leftAnkle.x + rightAnkle.x) / 2;
    const baseOfSupportY = (leftAnkle.y + rightAnkle.y) / 2;

    const deviationX = Math.abs(comX - baseOfSupportX);
    const isBalanced = deviationX < 0.08;
    const markerColor = isBalanced ? "#00ff88" : "#ff3b5c";

    this.ctx.beginPath();
    this.ctx.arc(comX * width, comY * height, 8, 0, 2 * Math.PI);
    this.ctx.fillStyle = markerColor;
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(comX * width, comY * height);
    this.ctx.lineTo(comX * width, baseOfSupportY * height);
    this.ctx.strokeStyle = markerColor;
    this.ctx.setLineDash([5, 5]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    this.ctx.beginPath();
    this.ctx.moveTo(leftAnkle.x * width, leftAnkle.y * height);
    this.ctx.lineTo(rightAnkle.x * width, rightAnkle.y * height);
    this.ctx.strokeStyle = "#00f0ff";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.fillStyle = markerColor;
    this.ctx.font = "14px 'Inter', sans-serif";
    this.ctx.fillText(
      `CoM Deviation: ${(deviationX * 100).toFixed(1)}%`,
      comX * width + 15,
      comY * height
    );
  }
}

export const overlayRenderer = new OverlayRenderer();
