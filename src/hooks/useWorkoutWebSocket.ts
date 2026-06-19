import { useEffect, useRef } from 'react';

const SOCKET_AUTH_TOKEN = import.meta.env.VITE_SOCKET_AUTH_TOKEN;

export function useWorkoutWebSocket(backendUrlRaw: string | undefined = import.meta.env.VITE_BACKEND_URL) {
  const wsSocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let wsSocket: WebSocket | null = null;
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
      const tokenParam = SOCKET_AUTH_TOKEN ? `&token=${encodeURIComponent(SOCKET_AUTH_TOKEN)}` : "";
      const wsUrl = backendUrl.replace(/^http/, "ws") + `/socket.io/?EIO=4&transport=websocket${tokenParam}`;
      wsSocket = new WebSocket(wsUrl);
      wsSocketRef.current = wsSocket;

      wsSocket.onopen = () => {};
      wsSocket.onerror = () => {
        console.warn(
          "[SpectraX WS] Could not connect to backend at",
          wsUrl,
          "— live backend features will be unavailable. " +
          "Check that the server is running and that VITE_BACKEND_URL is correct in .env.local."
        );
        wsSocketRef.current = null;
      };
    } catch (_) {
      wsSocketRef.current = null;
    }

    return () => {
      if (wsSocketRef.current) {
        try {
          wsSocketRef.current.close();
        } catch (err) {
          console.warn("WS close failed:", err);
        }
      }
    };
  }, [backendUrlRaw]);

  return wsSocketRef;
}
