import React from "react";

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  status: "green" | "yellow" | "red";
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  canvasRef,
  status,
}) => {
  return (
    <div
      className="camera-viewport"
      style={{ position: "absolute", inset: 0 }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.4,
          transform: "scaleX(-1)",
        }}
      />
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
        }}
      />
      {status === "red" && (
        <div
          className="workout-error-flash"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            boxShadow: "inset 0 0 100px rgba(255, 0, 0, 0.7)",
            pointerEvents: "none",
            zIndex: 10,
            animation: "pulse 1s infinite",
          }}
        />
      )}
    </div>
  );
};
