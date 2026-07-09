import React from "react";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { Wifi, WifiOff } from "lucide-react";

export const Tracker: React.FC = () => {
  const { isOnline } = useNetworkStatus();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderRadius: "20px",
        background: isOnline ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
        border: `1px solid ${isOnline ? "var(--neon-green, #22c55e)" : "var(--neon-red, #ef4444)"}`,
        color: isOnline ? "var(--neon-green, #22c55e)" : "var(--neon-red, #ef4444)",
        fontFamily: "var(--font-heading, inherit)",
        fontSize: "0.75rem",
        fontWeight: "bold",
        letterSpacing: "1px",
        boxShadow: `0 0 10px ${isOnline ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
        transition: "all 0.3s ease",
      }}
    >
      {isOnline ? (
        <>
          <Wifi size={14} />
          <span>OFFLINE READY</span>
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>OFFLINE MODE</span>
        </>
      )}
    </div>
  );
};

export default Tracker;
