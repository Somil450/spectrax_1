import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuth } from 'firebase/auth';

export function useWorkoutWebSocket(backendUrlRaw: string | undefined = import.meta.env.VITE_BACKEND_URL) {
  const wsSocketRef = useRef<Socket | null>(null);

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

        if (cancelled) return;

        // Get Firebase ID token for authentication
        let firebaseToken: string | undefined;
        try {
          const auth = getAuth();
          const user = auth.currentUser;
          if (user) {
            firebaseToken = await user.getIdToken();
          }
        } catch (tokenError) {
          console.warn("[SpectraX WS] Failed to get Firebase ID token:", tokenError);
        }

        if (cancelled) return;

        // Use Socket.IO client with auth option instead of URL query parameter
        const wsSocket = io(backendUrl, {
          auth: firebaseToken ? { token: firebaseToken } : undefined,
          transports: ['websocket'],
          reconnection: false,
        });
        wsSocketRef.current = wsSocket;

        wsSocket.on('connect_error', () => {
          console.warn(
            "[SpectraX WS] Could not connect to backend at",
            backendUrl,
            "— live backend features will be unavailable. " +
            "Check that the server is running and that VITE_BACKEND_URL is correct in .env.local."
          );
          wsSocketRef.current = null;
        });
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
