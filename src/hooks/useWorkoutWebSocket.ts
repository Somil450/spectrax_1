import { useEffect, useRef } from 'react';
import { auth } from '../config/firebase';

export function useWorkoutWebSocket(backendUrlRaw: string | undefined = import.meta.env.VITE_BACKEND_URL) {
  const wsSocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
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

        let firebaseToken = "";
        try {
          const currentUser = auth?.currentUser;
          if (currentUser) {
            firebaseToken = await currentUser.getIdToken();
          }
        } catch {
          // Not authenticated or Firebase not configured — connect without token
        }

        if (cancelled) return;
        const tokenParam = firebaseToken ? `&firebaseToken=${encodeURIComponent(firebaseToken)}` : "";
        const wsUrl = backendUrl.replace(/^http/, "ws") + `/socket.io/?EIO=4&transport=websocket${tokenParam}`;
        const wsSocket = new WebSocket(wsUrl);
        wsSocketRef.current = wsSocket;

        wsSocket.onopen = () => {};
        wsSocket.onerror = () => {
          console.warn(
            "[SpectraX WS] Could not connect to backend at",
            backendUrl,
            "— live backend features will be unavailable. " +
            "Check that the server is running and that VITE_BACKEND_URL is correct in .env.local."
          );
          wsSocketRef.current = null;
        };
      } catch (_) {
        wsSocketRef.current = null;
      }
    }

    connect();

    return () => {
      cancelled = true;
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
