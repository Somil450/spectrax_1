import React from "react";
import { Rocket } from "lucide-react";

interface ComingSoonProps {
  section: string;
  onGoHome: () => void;
}

export function ComingSoon({ section, onGoHome }: ComingSoonProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-primary, #fff)",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <Rocket size={64} color="var(--accent, #00e5ff)" style={{ marginBottom: "1.5rem", opacity: 0.8 }} />
      <h1 style={{ fontSize: "2.5rem", margin: 0, marginBottom: "0.5rem" }}>{section}</h1>
      <h2 style={{ fontSize: "1.2rem", opacity: 0.5, fontWeight: "normal", marginBottom: "2rem" }}>
        Coming Soon — we're building something great.
      </h2>
      <button
        onClick={onGoHome}
        style={{
          padding: "0.75rem 2rem",
          borderRadius: "12px",
          border: "none",
          background: "var(--accent, #00e5ff)",
          color: "#000",
          fontWeight: "bold",
          cursor: "pointer",
          fontSize: "1rem",
        }}
      >
        ← Back to Home
      </button>
    </div>
  );
}
