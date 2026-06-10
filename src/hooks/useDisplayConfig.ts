import { useState, useEffect, useCallback } from 'react';

export interface DisplayConfig {
  skeletonWires: boolean;
  graphFeeds: boolean;
  fpsDisplay: boolean;
}

const DEFAULT_CONFIG: DisplayConfig = {
  skeletonWires: true,
  graphFeeds: true,
  fpsDisplay: true,
};

const DB_NAME = 'spectrax_display_db';
const STORE_NAME = 'display_config';
const CONFIG_KEY = 'currentOverlayConfig';

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
};

export function useDisplayConfig() {
  const [config, setConfig] = useState<DisplayConfig>(DEFAULT_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const db = await openDb();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(CONFIG_KEY);

        request.onsuccess = () => {
          if (!mounted) return;
          if (request.result) {
            setConfig(request.result);
          }
          setIsLoaded(true);
        };

        request.onerror = () => {
          if (!mounted) return;
          console.warn('Failed to read config from IndexedDB, using defaults.');
          setIsLoaded(true);
        };
      } catch (error) {
        if (!mounted) return;
        console.warn('Failed to open IndexedDB, using defaults.', error);
        setIsLoaded(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const updateConfig = useCallback(async (newConfig: Partial<DisplayConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      // Asynchronously serialize to IndexedDB
      openDb()
        .then((db) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          store.put(updated, CONFIG_KEY);
        })
        .catch((error) => console.warn('Failed to save config to IndexedDB.', error));
      
      return updated;
    });
  }, []);

  return { config, updateConfig, isLoaded };
}
