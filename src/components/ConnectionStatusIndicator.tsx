import React, { useState, useEffect } from "react";

export type ConnectionState = "online" | "degraded" | "offline";

export const ConnectionStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<ConnectionState>("online");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkStatus = async () => {
      if (!navigator.onLine) {
        setStatus("offline");
        setLatency(null);
        return;
      }

      const start = Date.now();
      try {
        // Cache-busting ping to ensure we hit the server
        await fetch(`/favicon.svg?ping=${start}`, {
          method: "HEAD",
          cache: "no-store",
          mode: "same-origin"
        });
        const rtt = Date.now() - start;
        setLatency(rtt);
        if (rtt > 300) {
          setStatus("degraded");
        } else {
          setStatus("online");
        }
      } catch (e) {
        setStatus("offline");
        setLatency(null);
      }
    };

    // Run check immediately and then every 10 seconds
    checkStatus();
    const interval = setInterval(checkStatus, 10000);

    const handleOnline = () => {
      setStatus("online");
      checkStatus();
    };
    const handleOffline = () => {
      setStatus("offline");
      setLatency(null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case "online":
        return "#00ff88"; // neon green
      case "degraded":
        return "#ffdd00"; // neon yellow/orange
      case "offline":
        return "#ff3366"; // neon red
      default:
        return "#00ff88";
    }
  };

  const getTooltipText = () => {
    switch (status) {
      case "online":
        return "Sync Connected";
      case "degraded":
        return `Sync Slow (Latency: ${latency}ms)`;
      case "offline":
        return "Sync Offline (Local Mode)";
    }
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: "8px",
        cursor: "pointer"
      }}
      title={getTooltipText()}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: getStatusColor(),
          boxShadow: `0 0 8px ${getStatusColor()}`,
          transition: "background-color 0.3s, box-shadow 0.3s"
        }}
      />
    </div>
  );
};
