import React from "react";

interface NotFoundProps {
  onGoHome: () => void;
}

export function NotFound({ onGoHome }: NotFoundProps) {
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
      <h1 style={{ fontSize: "6rem", margin: 0, opacity: 0.3 }}>404</h1>
      <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        Page Not Found
      </h2>
      <p style={{ opacity: 0.6, marginBottom: "2rem" }}>
        Oops! This page doesn't exist.
      </p>
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
        Go Back Home
      </button>
    </div>
  );
}
