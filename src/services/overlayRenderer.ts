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
    this.drawBalanceIndicator(results);
  }

  private drawBalanceIndicator(results: Results) {
    if (!this.ctx || !results.poseLandmarks || results.poseLandmarks.length < 33) return;

    const landmarks = results.poseLandmarks;
    const width = this.ctx.canvas.width;
    const height = this.ctx.canvas.height;

    // Estimate Center of Mass (COM) using shoulders and hips
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    const comX = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
    const comY = (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4;

    // Determine Base of Support using ankles
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const baseX = (leftAnkle.x + rightAnkle.x) / 2;
    const baseY = (leftAnkle.y + rightAnkle.y) / 2;

    // Calculate displacement deviation
    const deviation = Math.abs(comX - baseX);
    // Consider balanced if horizontal deviation is within 5% of frame width
    const isBalanced = deviation < 0.05;

    const markerColor = isBalanced ? "#00ff88" : "#ff3b5c"; // Green for balanced, Red for unbalanced

    // Draw connection line from COM to Base
    this.ctx.beginPath();
    this.ctx.moveTo(comX * width, comY * height);
    this.ctx.lineTo(baseX * width, baseY * height);
    this.ctx.strokeStyle = markerColor;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.stroke();
    this.ctx.setLineDash([]); // Reset dashed lines

    // Draw Base Marker
    this.ctx.beginPath();
    this.ctx.arc(baseX * width, baseY * height, 6, 0, 2 * Math.PI);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fill();

    // Draw COM Marker
    this.ctx.beginPath();
    this.ctx.arc(comX * width, comY * height, 10, 0, 2 * Math.PI);
    this.ctx.fillStyle = markerColor;
    this.ctx.fill();
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.stroke();
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