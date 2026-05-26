import type { Results } from "@mediapipe/pose";

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

    for (const landmark of results.poseLandmarks) {
      this.ctx.beginPath();

      this.ctx.arc(
        landmark.x * this.ctx.canvas.width,
        landmark.y * this.ctx.canvas.height,
        5,
        0,
        2 * Math.PI
      );

      this.ctx.fillStyle = color;
      this.ctx.fill();
    }

    this.drawScanningLine();
  }

  drawGhost(landmarks: any[]) {
    if (!this.ctx || !landmarks) return;

    // Ghost color: glowing cyan with transparency
    const ghostColor = "rgba(0, 255, 255, 0.4)";
    // Shift ghost to the left (note: the canvas might be horizontally flipped depending on setup, 
    // but typically a shift of -0.25 moves it visually to the side)
    const xOffset = -0.25; 

    this.ctx.save();
    this.ctx.shadowColor = "rgba(0, 255, 255, 0.8)";
    this.ctx.shadowBlur = 12;

    // Draw lines
    const connections = [
      [11, 13], [13, 15], // left arm
      [12, 14], [14, 16], // right arm
      [11, 12], [23, 24], [11, 23], [12, 24], // torso
      [23, 25], [25, 27], [27, 29], [29, 31], [31, 27], // left leg + foot
      [24, 26], [26, 28], [28, 30], [30, 32], [32, 28], // right leg + foot
      [0, 1], [1, 2], [2, 3], [3, 7], // face right
      [0, 4], [4, 5], [5, 6], [6, 8], // face left
      [9, 10] // mouth
    ];

    this.ctx.strokeStyle = ghostColor;
    this.ctx.lineWidth = 3;

    for (const [a, b] of connections) {
      const lmA = landmarks[a];
      const lmB = landmarks[b];
      
      if (!lmA || !lmB) continue;
      if ((lmA.visibility && lmA.visibility < 0.5) || (lmB.visibility && lmB.visibility < 0.5)) continue;

      const xA = (lmA.x + xOffset) * this.ctx.canvas.width;
      const yA = lmA.y * this.ctx.canvas.height;
      const xB = (lmB.x + xOffset) * this.ctx.canvas.width;
      const yB = lmB.y * this.ctx.canvas.height;

      this.ctx.beginPath();
      this.ctx.moveTo(xA, yA);
      this.ctx.lineTo(xB, yB);
      this.ctx.stroke();
    }

    // Draw joints
    for (const landmark of landmarks) {
      if (landmark.visibility && landmark.visibility < 0.5) continue;

      this.ctx.beginPath();
      
      const x = (landmark.x + xOffset) * this.ctx.canvas.width;
      const y = landmark.y * this.ctx.canvas.height;
      
      this.ctx.arc(
        x,
        y,
        4,
        0,
        2 * Math.PI
      );

      this.ctx.fillStyle = "rgba(0, 255, 255, 0.7)";
      this.ctx.fill();
    }

    this.ctx.restore();
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
}

export const overlayRenderer = new OverlayRenderer();