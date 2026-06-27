import { useEffect, useRef, useState } from 'react';
import { auth } from '../config/firebase';

export function useWorkoutWebSocket(backendUrlRaw: string | undefined = import.meta.env.VITE_BACKEND_URL) {
  const wsSocketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let wsSocket: WebSocket | null = null;
    let isCancelled = false;

    const connectWebSocket = async () => {
      try {
        if (!backendUrlRaw) {
          console.warn(
            "[SpectraX] VITE_BACKEND_URL is not set. " +
            "Falling back to http://localhost:3001. " +
            "Set VITE_BACKEND_URL in .env.local for non-local deployments " +
            "(see .env.example for the expected format)."
          );
        }
        
        let tokenParam = "";
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            const token = await currentUser.getIdToken();
            tokenParam = `&token=${encodeURIComponent(token)}`;
          } catch (e) {
            console.error("[SpectraX WS] Failed to get Firebase JWT token:", e);
          }
        }

        if (isCancelled) return;

        const backendUrl = (backendUrlRaw ?? "http://localhost:3001").replace(/\/+$/, "");
        const wsUrl = backendUrl.replace(/^http/, "ws") + `/socket.io/?EIO=4&transport=websocket${tokenParam}`;
        
        wsSocket = new WebSocket(wsUrl);
        wsSocketRef.current = wsSocket;

        wsSocket.onopen = () => {
          setIsConnected(true);
        };
        wsSocket.onerror = () => {
          console.warn(
            "[SpectraX WS] Could not connect to backend at",
            backendUrl,
            "— live backend features will be unavailable. " +
            "Check that the server is running and that VITE_BACKEND_URL is correct in .env.local."
          );
          wsSocketRef.current = null;
          setIsConnected(false);
        };
        wsSocket.onclose = () => {
          setIsConnected(false);
        };
      } catch (err) {
        console.error("[SpectraX WS] WebSocket initialization error:", err);
        wsSocketRef.current = null;
        setIsConnected(false);
      }
    };

    // Firebase auth state might not be initialized immediately on mount.
    // Listen to auth state to trigger connection once user is known.
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (wsSocket) {
        wsSocket.close();
      }
      connectWebSocket();
    });

    return () => {
      isCancelled = true;
      unsubscribe();
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
