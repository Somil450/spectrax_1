import React, { useState, useEffect, useRef } from "react";
import { Activity } from "lucide-react";

export const FpsMonitor: React.FC = () => {
  const [fps, setFps] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const requestRef = useRef<number>();

  useEffect(() => {
    const updateFps = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      frameCountRef.current++;

      if (delta >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / delta));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      requestRef.current = requestAnimationFrame(updateFps);
    };

    if (isVisible) {
      requestRef.current = requestAnimationFrame(updateFps);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isVisible]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: "fixed",
          top: "80px",
          right: "20px",
          background: "rgba(10, 10, 26, 0.8)",
          color: "var(--neon-cyan)",
          border: "1px solid var(--neon-cyan)",
          borderRadius: "50%",
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 100,
          backdropFilter: "blur(8px)",
          boxShadow: "0 0 10px rgba(0, 255, 255, 0.2)",
        }}
        title="Show FPS"
        aria-label="Show FPS"
      >
        <Activity size={16} />
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "80px",
        right: "20px",
        background: "rgba(10, 10, 26, 0.8)",
        border: "1px solid var(--neon-cyan)",
        borderRadius: "12px",
        padding: "6px 12px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        zIndex: 100,
        backdropFilter: "blur(8px)",
        boxShadow: "0 0 10px rgba(0, 255, 255, 0.2)",
        cursor: "pointer",
      }}
      onClick={() => setIsVisible(false)}
      title="Hide FPS"
    >
      <Activity size={14} color="var(--neon-cyan)" />
      <span
        style={{
          color: fps >= 15 ? "var(--neon-green, #4ade80)" : "var(--neon-yellow, #facc15)",
          fontFamily: "monospace",
          fontSize: "0.9rem",
          fontWeight: 700,
        }}
      >
        {fps} FPS
      </span>
    </div>
  );
};
