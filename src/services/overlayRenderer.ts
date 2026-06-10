import type { Results } from "@mediapipe/pose";
// MediaPipe's npm packages are not ESM-compatible. We use globals from CDN scripts.
const POSE_CONNECTIONS = (window as any).POSE_CONNECTIONS;
const drawConnectors = (window as any).drawConnectors;
const drawLandmarks = (window as any).drawLandmarks;

/**
 * overlayRenderer.ts
 * High-performance canvas drawing with dynamic joint color-coding.
 */

export class OverlayRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private scanY: number = 0;
  private scanDirection: number = 1;

  setContext(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  clear() {
    if (!this.ctx) return;

    this.ctx.clearRect(
      0,
      0,
      this.ctx.canvas.width,
      this.ctx.canvas.height
    );
  }

  private getStatusColor(status: "green" | "yellow" | "red") {
    switch (status) {
      case "green":
        return "#00ff88";

      case "yellow":
        return "#ffd600";

      case "red":
        return "#ff3b5c";

      default:
        return "#00f0ff";
    }
  }

  draw(
    results: Results,
    status: "green" | "yellow" | "red" = "green",
    primaryJoints: number[] = []
  ) {
    if (!this.ctx || !results.poseLandmarks) return;

    this.clear();

    const color = this.getStatusColor(status);
    const glow = `${color}88`;

    for (const landmark of results.poseLandmarks) {
      this.ctx.beginPath();

      this.ctx.arc(
        landmark.x * this.ctx.canvas.width,
        landmark.y * this.ctx.canvas.height,
        5,
        0,
        2 * Math.PI
      );
this.ctx.fill();
}

const drawConnectors = (window as any).drawConnectors;
const drawLandmarks = (window as any).drawLandmarks;
const POSE_CONNECTIONS = (window as any).POSE_CONNECTIONS;

if (drawConnectors && POSE_CONNECTIONS && drawLandmarks) {
      // 1. Draw standard connectors with status color
      drawConnectors(this.ctx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: 'rgba(255, 255, 255, 0.2)',
        lineWidth: 2,
      });

      // 2. Draw highlighted connections for primary workout joints
      // This provides stronger visual feedback on the active movement.
      drawConnectors(this.ctx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: color,
        lineWidth: 4,
      });

      // 3. Draw Landmarks with dynamic size/glow
      drawLandmarks(this.ctx, results.poseLandmarks, {
        color: '#ffffff',
        fillColor: (data: any) => {
// Highlight primary joints with stronger color
if (primaryJoints.includes(data.index!)) return color;

if (data.index! >= 11) {
  if (data.index! % 2 !== 0) return 'rgba(0, 240, 255, 0.8)'; // Neon Blue (Left)
  if (data.index! % 2 === 0) return 'rgba(157, 78, 221, 0.8)'; // Neon Purple (Right)
}
return 'rgba(255,255,255,0.5)';
        },
        lineWidth: 1,
        radius: (data: any) => {
          return primaryJoints.includes(data.index!) ? 6 : 3;
        }
      });

      // Global glow
this.ctx.shadowBlur = 15;
this.ctx.shadowColor = color;
}

this.drawScanningLine();
this.drawCenterOfMass(results.poseLandmarks);
  }

  private drawScanningLine() {
    if (!this.ctx) return;

    const canvas = this.ctx.canvas;

    this.scanY += 3 * this.scanDirection;

    if (this.scanY > canvas.height || this.scanY < 0) {
      this.scanDirection *= -1;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(0, this.scanY);
    this.ctx.lineTo(canvas.width, this.scanY);

    this.ctx.strokeStyle = "rgba(0,240,255,0.3)";
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
  }

  private drawCenterOfMass(landmarks: any[]) {
    if (!this.ctx || landmarks.length < 29) return;

    const width = this.ctx.canvas.width;
    const height = this.ctx.canvas.height;

    // Biomechanical Center of Mass estimation (approx. based on torso)
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    const comX = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
    const comY = (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4;

    // Base of support (ankles)
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const baseOfSupportX = (leftAnkle.x + rightAnkle.x) / 2;
    const baseOfSupportY = (leftAnkle.y + rightAnkle.y) / 2;

    // Calculate displacement deviation
    const deviationX = Math.abs(comX - baseOfSupportX);
    // Determine balance status based on deviation threshold (e.g., 0.08 of frame width)
    const isBalanced = deviationX < 0.08;
    const markerColor = isBalanced ? "#00ff88" : "#ff3b5c"; // green if balanced, red if unbalanced

    // Draw CoM marker
    this.ctx.beginPath();
    this.ctx.arc(comX * width, comY * height, 8, 0, 2 * Math.PI);
    this.ctx.fillStyle = markerColor;
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.stroke();

    // Draw displacement line (CoM to Base of Support level)
    this.ctx.beginPath();
    this.ctx.moveTo(comX * width, comY * height);
    this.ctx.lineTo(comX * width, baseOfSupportY * height);
    this.ctx.strokeStyle = markerColor;
    this.ctx.setLineDash([5, 5]);
    this.ctx.stroke();
    this.ctx.setLineDash([]); // Reset line dash

    // Draw Base of Support line
    this.ctx.beginPath();
    this.ctx.moveTo(leftAnkle.x * width, leftAnkle.y * height);
    this.ctx.lineTo(rightAnkle.x * width, rightAnkle.y * height);
    this.ctx.strokeStyle = "#00f0ff";
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw Deviation Text
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