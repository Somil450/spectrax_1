import { useEffect, useRef, useState } from 'react';

interface UseWorkoutWebSocketResult {
  isConnected: boolean;
  wsSocketRef: React.MutableRefObject<WebSocket | null>;
}

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

/**
 * Maintains a WebSocket connection to the backend's socket.io endpoint and
 * exposes the current connection state so the UI can warn the user when the
 * live feed drops (e.g. internet loss or a server restart).
 *
 * The connection is tracked in React state and auto-reconnects with an
 * exponential backoff so reps keep being tracked once the connection is
 * restored — without requiring a page reload.
 */
export function useWorkoutWebSocket(backendUrlRaw: string | undefined = import.meta.env.VITE_BACKEND_URL): UseWorkoutWebSocketResult {
  const wsSocketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function scheduleReconnect() {
      if (cancelled) return;
      const delay = Math.min(RECONNECT_DELAY_MS * Math.pow(2, attempt), MAX_RECONNECT_DELAY_MS);
      attempt++;
      reconnectTimer = setTimeout(connect, delay);
    }

    function connect() {
      try {
        if (!backendUrlRaw) {
          console.warn(
            "[SpectraX] VITE_BACKEND_URL is not set. " +
            "Falling back to http://localhost:3001. " +
            "Set VITE_BACKEND_URL in .env.local for non-local deployments " +
            "(see .env.example for the expected format)."
          );
        }
        const backendUrl = (backendUrlRaw ?? "http://localhost:3001").replace(/\/+$/, "");

        if (cancelled) return;
        const wsUrl = backendUrl.replace(/^http/, "ws") + "/socket.io/?EIO=4&transport=websocket";
        const wsSocket = new WebSocket(wsUrl);
        wsSocketRef.current = wsSocket;

        wsSocket.onopen = () => {
          attempt = 0;
          setIsConnected(true);
        };
        wsSocket.onclose = () => {
          setIsConnected(false);
          if (wsSocketRef.current === wsSocket) {
            wsSocketRef.current = null;
          }
          scheduleReconnect();
        };
        wsSocket.onerror = () => {
          console.warn(
            "[SpectraX WS] Could not connect to backend at",
            backendUrl,
            "— live backend features will be unavailable. " +
            "Check that the server is running and that VITE_BACKEND_URL is correct in .env.local."
          );
          setIsConnected(false);
        };
      } catch (_) {
        wsSocketRef.current = null;
        setIsConnected(false);
        scheduleReconnect();
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (wsSocketRef.current) {
        try {
          wsSocketRef.current.close();
        } catch (err) {
          console.warn("WS close failed:", err);
        }
      }
    };
  }, [backendUrlRaw]);

  return { isConnected, wsSocketRef };
}
