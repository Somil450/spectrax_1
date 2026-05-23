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