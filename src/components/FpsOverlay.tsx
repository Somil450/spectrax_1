import React from "react";

interface FpsOverlayProps {
  fps: number;
}

function fpsColor(fps: number): string {
  if (fps >= 50) return "#00ff88";
  if (fps >= 30) return "#ffcc00";
  return "#ff4444";
}

const FpsOverlay: React.FC<FpsOverlayProps> = ({ fps }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 50,
        background: "rgba(0,0,0,0.55)",
        borderRadius: 6,
        padding: "2px 10px",
        fontFamily: "monospace",
        fontSize: 13,
        fontWeight: 700,
        color: fpsColor(fps),
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {fps} FPS
    </div>
  );
};

export default FpsOverlay;
