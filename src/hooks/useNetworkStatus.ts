/**
 * useNetworkStatus Hook
 * Tracks browser online/offline state and triggers sync on reconnection.
 */

import { useState, useEffect, useCallback } from "react";

export interface NetworkStatus {
  isOnline: boolean;
}

export function useNetworkStatus(onReconnect?: () => void): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    onReconnect?.();
  }, [onReconnect]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline };
}

export default useNetworkStatus;
