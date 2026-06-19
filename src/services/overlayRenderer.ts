import type { Results } from "@mediapipe/pose";

const POSE_CONNECTIONS = (window as any).POSE_CONNECTIONS;
const drawConnectors = (window as any).drawConnectors;
const drawLandmarks = (window as any).drawLandmarks;

import type { Mesh3DVertex } from "../types/pose";

export class OverlayRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private scanY: number = 0;
  private scanDirection: number = 1;
  private draw3DEnabled = false;
  private meshVertices: Mesh3DVertex[] | null = null;

  setContext(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
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
    primaryJoints: number[] = []
  ) {
    if (!this.ctx || !results.poseLandmarks) return;

    this.clear();

    const color = this.getStatusColor(status);
    const width = this.ctx.canvas.width;
    const height = this.ctx.canvas.height;

    if (this.draw3DEnabled && this.meshVertices) {
      this.draw3DMesh(this.meshVertices, width, height, color);
    }

    if (drawConnectors && POSE_CONNECTIONS && drawLandmarks) {
      drawConnectors(this.ctx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: "rgba(255, 255, 255, 0.2)",
        lineWidth: 2,
      });

      drawConnectors(this.ctx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: color,
        lineWidth: 4,
      });

      drawLandmarks(this.ctx, results.poseLandmarks, {
        color: "#ffffff",
        fillColor: (data: any) => {
          if (primaryJoints.includes(data.index!)) return color;
          if (data.index! >= 11) {
            if (data.index! % 2 !== 0) return "rgba(0, 240, 255, 0.8)";
            if (data.index! % 2 === 0) return "rgba(157, 78, 221, 0.8)";
          }
          return "rgba(255,255,255,0.5)";
        },
        lineWidth: 1,
        radius: (data: any) => {
          return primaryJoints.includes(data.index!) ? 6 : 3;
        },
      });

      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = color;
    }

    this.drawScanningLine();
    this.drawCenterOfMass(results.poseLandmarks);
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

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

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