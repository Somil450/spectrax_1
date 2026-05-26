import React from "react";

interface Recommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

interface Props {
  recommendations: Recommendation[];
}

const priorityColors = {
  high: "var(--neon-red)",
  medium: "var(--neon-yellow)",
  low: "var(--neon-green)",
};

const AIRecommendations: React.FC<Props> = ({
  recommendations,
}) => {

  if (!recommendations.length) return null;

  return (
    <div
      className="glass animate-in"
      style={{
        width: "100%",
        maxWidth: "600px",
        padding: "24px",
        marginBottom: "30px",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          color: "var(--neon-cyan)",
          fontSize: "0.75rem",
          letterSpacing: "2px",
          textTransform: "uppercase",
          marginBottom: "18px",
          fontWeight: 800,
        }}
      >
        🤖 AI Workout Recommendations
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {recommendations.map((rec, index) => (
          <div
            key={index}
            style={{
              background: "rgba(255,255,255,0.03)",
              borderLeft: `4px solid ${priorityColors[rec.priority]}`,
              borderRadius: "12px",
              padding: "14px",
            }}
          >
            <div
              style={{
                color: "#fff",
                fontWeight: 700,
                marginBottom: "6px",
              }}
            >
              {rec.title}
            </div>

            <div
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.9rem",
                lineHeight: "1.5",
              }}
            >
              {rec.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIRecommendations;