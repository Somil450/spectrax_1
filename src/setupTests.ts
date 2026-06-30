// Jest setup file for test configuration
import "@testing-library/jest-dom";

class LocalStorageMock implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] !== undefined ? keys[index] : null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

const localStorageMock = new LocalStorageMock();
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
}

// Suppress console errors during tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render") ||
        args[0].includes("Warning: useLayoutEffect"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// ── IndexedDB In-Memory Mock for Testing ─────────────────────────────────────
const storeMap = new Map<string, any>();

class MockIDBRequest extends EventTarget {
  result: any;
  error: any = null;
  set onsuccess(cb: any) {
    this.addEventListener("success", cb);
  }
  set onerror(cb: any) {
    this.addEventListener("error", cb);
  }
  set onupgradeneeded(cb: any) {
    this.addEventListener("upgradeneeded", cb);
  }
}

const mockIndexedDB = {
  open(name: string, version: number) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      const db = {
        objectStoreNames: {
          contains: () => true
        },
        createObjectStore: () => {},
        transaction(storeName: string, mode: string) {
          return {
            objectStore(name: string) {
              return {
                put(value: any) {
                  const r = new MockIDBRequest();
                  storeMap.set(value.id, value);
                  setTimeout(() => {
                    r.dispatchEvent(new Event("success"));
                  }, 0);
                  return r;
                },
                getAll() {
                  const r = new MockIDBRequest();
                  r.result = Array.from(storeMap.values());
                  setTimeout(() => {
                    r.dispatchEvent(new Event("success"));
                  }, 0);
                  return r;
                },
                clear() {
                  const r = new MockIDBRequest();
                  storeMap.clear();
                  setTimeout(() => {
                    r.dispatchEvent(new Event("success"));
                  }, 0);
                  return r;
                },
                delete(id: any) {
                  const r = new MockIDBRequest();
                  storeMap.delete(id);
                  setTimeout(() => {
                    r.dispatchEvent(new Event("success"));
                  }, 0);
                  return r;
                }
              };
            }
          };
        }
      };
      req.result = db;
      req.dispatchEvent(new Event("success"));
    }, 0);
    return req;
  }
};

Object.defineProperty(globalThis, "indexedDB", {
  value: mockIndexedDB,
  writable: true,
  configurable: true
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "indexedDB", {
    value: mockIndexedDB,
    writable: true,
    configurable: true
  });
}

