import React from "react";
import "./ScanFrameOverlay.css";

interface ScanFrameOverlayProps {
  status: "green" | "yellow" | "red";
}

const STATUS_BORDER: Record<ScanFrameOverlayProps["status"], string> = {
  green: "rgba(0, 255, 136, 0.8)",
  yellow: "rgba(255, 214, 0, 0.8)",
  red: "rgba(255, 59, 92, 0.9)",
};

/**
 * Holographic camera-framing overlay: a pulsing detection border, animated
 * corner brackets and a faint scan grid that react to the live pose status.
 */
export const ScanFrameOverlay: React.FC<ScanFrameOverlayProps> = ({ status }) => {
  const borderColor = STATUS_BORDER[status];
  return (
    <div className="scan-frame" aria-hidden="true">
      <span
        className="scan-frame__border"
        style={{
          boxShadow: `0 0 0 2px ${borderColor}, inset 0 0 0 2px ${borderColor}, 0 0 24px ${borderColor}`,
        }}
      />
      <span className="scan-frame__grid" />
      <span className="scan-frame__corner scan-frame__corner--tl" />
      <span className="scan-frame__corner scan-frame__corner--tr" />
      <span className="scan-frame__corner scan-frame__corner--bl" />
      <span className="scan-frame__corner scan-frame__corner--br" />
    </div>
  );
};
