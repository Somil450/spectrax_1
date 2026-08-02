// src/components/DifficultyInsights.tsx
import React from "react";
import type { DifficultyAssessment } from "../engine/difficultyEngine";

interface Props {
  assessments: DifficultyAssessment[];
}

const directionStyles = {
  progression: {
    borderColor: "rgba(34, 211, 160, 0.35)",
    accent: "var(--neon-green)",
    background: "rgba(34, 211, 160, 0.05)",
    label: "Progression",
    labelColor: "#22d3a0",
  },
  maintenance: {
    borderColor: "rgba(96, 165, 250, 0.35)",
    accent: "var(--neon-cyan)",
    background: "rgba(96, 165, 250, 0.05)",
    label: "Maintain",
    labelColor: "#60a5fa",
  },
  regression: {
    borderColor: "rgba(251, 191, 36, 0.4)",
    accent: "var(--neon-yellow)",
    background: "rgba(251, 191, 36, 0.05)",
    label: "Technique Focus",
    labelColor: "#fbbf24",
  },
} as const;

const DifficultyInsights: React.FC<Props> = ({ assessments }) => {
  if (!assessments.length) return null;

  return (
    <div className="difficulty-insights">
      <div
        style={{
          color: "var(--neon-cyan)",
          fontSize: "0.75rem",
          letterSpacing: "2px",
          textTransform: "uppercase",
          marginBottom: "14px",
          fontWeight: 800,
        }}
      >
        🎚️ Difficulty Auto-Scaling
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "14px",
        }}
      >
        {assessments.map((a) => {
          const style = directionStyles[a.direction];
          return (
            <div
              key={a.exerciseKey}
              className="glass"
              data-testid="difficulty-assessment"
              style={{
                border: `1px solid ${style.borderColor}`,
                background: style.background,
                borderRadius: "14px",
                padding: "16px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  background: style.accent,
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "1rem",
                    fontFamily: "'Syne', sans-serif",
                  }}
                >
                  {a.exerciseName}
                </span>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: style.labelColor,
                    border: `1px solid ${style.borderColor}`,
                    borderRadius: "999px",
                    padding: "3px 10px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {style.label}
                </span>
              </div>

              <div
                style={{
                  color: "#fff",
                  fontWeight: 700,
                  marginBottom: "6px",
                  fontSize: "0.95rem",
                }}
              >
                {a.title}
              </div>

              <div
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.8rem",
                  fontFamily: "'Space Mono', monospace",
                  marginBottom: "10px",
                }}
              >
                {a.summary}
              </div>

              <div
                style={{
                  color: "var(--text-primary)",
                  fontSize: "0.85rem",
                  lineHeight: "1.55",
                }}
              >
                {a.recommendation}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DifficultyInsights;
