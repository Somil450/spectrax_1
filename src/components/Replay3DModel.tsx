import React from "react";

export interface ReplayFrame {
  timestamp: number;
  landmarks: { x: number; y: number; z: number }[];
  angles?: Record<string, number>;
  feedback?: string;
  exercise?: string;
}

export interface Replay3DModelProps {
  frames: ReplayFrame[];
  modelUrl?: string;
  currentFrameIdx?: number;
  isPlaying?: boolean;
  onFrameChange?: (idx: number) => void;
  onPlayToggle?: () => void;
  hideControls?: boolean;
}

// Minimal placeholder implementation so TypeScript/Vite succeed.
export const Replay3DModel: React.FC<Replay3DModelProps> = ({ frames }) => {
  return (
    <div style={{ width: "100%", height: 300, background: "#000" }}>
      <div style={{ color: "#fff", padding: 12 }}>
        Replay3DModel placeholder — {frames?.length || 0} frames
      </div>
    </div>
  );
};

export default Replay3DModel;
