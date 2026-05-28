import React from "react";

export interface ReplayFrame {
  timestamp: number;
  landmarks: { x: number; y: number; z: number; visibility?: number }[];
  angles?: Record<string, number>;
  feedback: string;
  exercise?: string;
  repCount?: number;
}

export interface Replay3DModelProps {
  frames: ReplayFrame[];
  modelUrl?: string;
  currentFrameIdx?: number;
  isPlaying?: boolean;
  onFrameChange?: (idx: number) => void;
  onPlayToggle?: () => void;
  hideControls?: boolean;
  skin?: string;
}

/**
 * Lightweight placeholder renderer.
 *
 * The previous implementation was failing compilation due to duplicated/partial
 * merges. This component keeps the replay screen functional and buildable.
 */
export const Replay3DModel: React.FC<Replay3DModelProps> = ({
  frames,
  currentFrameIdx = 0,
}) => {
  const safeIdx = Math.max(0, Math.min(currentFrameIdx, Math.max(0, frames.length - 1)));
  const frame = frames[safeIdx];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at top, rgba(0,240,255,0.06), transparent 55%), rgba(0,0,0,0.2)",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "min(520px, calc(100vw - 32px))",
          padding: 16,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(10, 10, 26, 0.45)",
          backdropFilter: "blur(10px)",
          color: "rgba(255,255,255,0.92)",
          fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        <div style={{ fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>
          Replay renderer
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.45 }}>
          Frame: {safeIdx} / {Math.max(0, frames.length - 1)}
          <br />
          Timestamp: {frame?.timestamp ?? "—"}
          <br />
          Landmarks: {frame?.landmarks?.length ?? 0}
          <br />
          Feedback: {frame?.feedback ?? "—"}
        </div>
      </div>
    </div>
  );
};

