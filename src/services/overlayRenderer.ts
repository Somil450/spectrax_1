import type { Results } from '@mediapipe/pose';

// MediaPipe's npm packages are not ESM-compatible. We use globals from the CDN scripts.
const POSE_CONNECTIONS = (window as any).POSE_CONNECTIONS;
const drawConnectors = (window as any).drawConnectors;
const drawLandmarks = (window as any).drawLandmarks;


/**
 * overlayRenderer.ts (Updated for Multi-Exercise)
 * High-performance canvas drawing with dynamic joint color-coding.
 * Highlights primary movement joints in Green/Yellow/Red.
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
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  /**
   * Returns a neon color based on tracking status.
   */
  private getStatusColor(status: 'green' | 'yellow' | 'red') {
    switch (status) {
      case 'green': return '#00ff88';
      case 'yellow': return '#ffd600';
      case 'red': return '#ff3b5c';
      default: return '#00f0ff';
    }
  }

  /**
   * Draws the pose skeleton with dynamic highlights.
   * @param results MediaPipe Pose results.
   * @param status Overall exercise status.
   * @param primaryJoints Landmarks relevant to the current exercise.
   */
  draw(results: Results, status: 'green' | 'yellow' | 'red' = 'green', primaryJoints: number[] = []) {
    if (!this.ctx || !results.poseLandmarks) return;

    this.clear();
    const color = this.getStatusColor(status);
    const glow = `${color}88`;

    this.drawScanningLine();

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
      fillColor: (data) => {
          // Highlight primary joints with stronger color
          return primaryJoints.includes(data.index!) ? color : 'rgba(255,255,255,0.5)';
      },
      lineWidth: 1,
      radius: (data) => {
        return primaryJoints.includes(data.index!) ? 6 : 2;
      }
    });

    // Global glow
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = glow;
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
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
  }
}

export const overlayRenderer = new OverlayRenderer();
