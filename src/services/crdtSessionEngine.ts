/**
 * crdtSessionEngine.ts
 * Wraps active workout state as a Yjs document.
 * Each rep is an operation with HLC timestamp.
 * Supports offline edits, automatic merge, and session handoff.
 */

import * as Y from "yjs";
import { encode, decode } from "@msgpack/msgpack";
import { nowHLC, compareHLC, updateHLC, hlcToString, hlcFromString, type HLCTimestamp } from "../utils/hybridLogicalClock";
import type { EngineState } from "./exerciseEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RepOperation {
  hlc: HLCTimestamp;
  repNumber: number;
  totalReps: number;
  correctReps: number;
  repScore: number;
  repDeviation: number;
  stage: "up" | "down";
  angles: Record<string, number>;
  feedback: string;
  mistakes: Record<string, number>;
  depthResult?: any;
  vbtMetrics?: any;
  timestamp: number;
}

export interface SessionSnapshot {
  sessionId: string;
  exerciseKey: string;
  exerciseName: string;
  startTime: number;
  lastUpdate: number;
  hlcVector: Record<string, string>; // nodeId -> hlc string
  state: Partial<EngineState>;
  repOps: RepOperation[];
  compressedFrames?: Uint8Array; // Yjs state as update
}

// ─── Yjs Document Structure ──────────────────────────────────────────────────

const YJS_DOC_NAME = "spectrax_session";
const YJS_STORE = "yjs_updates";
const DB_NAME = "spectrax_db";
const DB_VERSION = 4; // Bumped for Yjs store

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(YJS_STORE)) {
        db.createObjectStore(YJS_STORE, { keyPath: "sessionId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// ─── CRDT Session Engine ─────────────────────────────────────────────────────

export class CRDTSessionEngine {
  private doc: Y.Doc;
  private yState: Y.Map<any>;
  private yReps: Y.Array<RepOperation>;
  private sessionId: string;
  private exerciseKey: string;
  private exerciseName: string;
  private startTime: number;
  private hlcVector: Map<string, HLCTimestamp>;
  private updateHandler: (update: Uint8Array, origin: any) => void;

  constructor(exerciseKey: string, exerciseName: string) {
    this.sessionId = `${exerciseKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.exerciseKey = exerciseKey;
    this.exerciseName = exerciseName;
    this.startTime = Date.now();
    this.hlcVector = new Map();

    this.doc = new Y.Doc();
    this.yState = this.doc.getMap("state");
    this.yReps = this.doc.getArray("reps");

    // Track all updates for persistence/sync
    this.updateHandler = (update: Uint8Array) => {
      this.persistUpdate(update);
    };
    this.doc.on("update", this.updateHandler);

    // Initialize base state
    this.yState.set("exerciseKey", exerciseKey);
    this.yState.set("exerciseName", exerciseName);
    this.yState.set("startTime", this.startTime);
    this.yState.set("sessionId", this.sessionId);
  }

  /**
   * Record a rep operation with HLC timestamp.
   * Automatically merges with concurrent edits from other devices.
   */
  recordRep(state: EngineState, angles: Record<string, number>): RepOperation {
    const hlc = nowHLC();
    this.hlcVector.set(hlc.nodeId, hlc);

    const op: RepOperation = {
      hlc,
      repNumber: state.reps,
      totalReps: state.totalReps,
      correctReps: state.correctReps,
      repScore: state.repScores[state.repScores.length - 1] || 0,
      repDeviation: state.repDeviations[state.repDeviations.length - 1] || 0,
      stage: state.stage,
      angles: { ...angles },
      feedback: state.feedback,
      mistakes: { ...state.mistakes },
      depthResult: state.lastDepthResult,
      vbtMetrics: state.vbtMetrics,
      timestamp: Date.now(),
    };

    this.yReps.push([op]);
    this.yState.set("lastUpdate", Date.now());
    this.yState.set("hlcVector", this.serializeHlcVector());

    return op;
  }

  /**
   * Update current engine state (non-rep changes: stage, feedback, etc.)
   */
  updateState(state: Partial<EngineState>): void {
    const hlc = nowHLC();
    this.hlcVector.set(hlc.nodeId, hlc);

    for (const [key, value] of Object.entries(state)) {
      if (value !== undefined) {
        this.yState.set(key, value);
      }
    }
    this.yState.set("lastUpdate", Date.now());
    this.yState.set("hlcVector", this.serializeHlcVector());
  }

  /**
   * Apply a remote Yjs update (from another device or sync).
   * Automatically merges without conflicts.
   */
  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update);
    // Update local HLC to be > remote
    const remoteVector = this.parseHlcVector(this.yState.get("hlcVector") || {});
    for (const [, hlc] of remoteVector) {
      updateHLC(hlc);
    }
  }

  /**
   * Encode current document state for QR handoff or network transfer.
   */
  encodeState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  /**
   * Create engine from encoded state (session handoff receiver).
   */
  static fromState(update: Uint8Array): CRDTSessionEngine {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, update);

    const yState = doc.getMap("state");
    const engine = new CRDTSessionEngine(
      (yState.get("exerciseKey") as string) || "unknown",
      (yState.get("exerciseName") as string) || "Unknown"
    );

    // Replace the new doc with the received state
    engine.doc.destroy();
    engine.doc = doc;
    engine.yState = yState;
    engine.yReps = doc.getArray("reps");
    engine.sessionId = (yState.get("sessionId") as string) || engine.sessionId;
    engine.startTime = (yState.get("startTime") as number) || engine.startTime;

    // Restore HLC vector
    const hlcVectorRaw = (yState.get("hlcVector") as Record<string, string>) || {};
    engine.hlcVector = engine.parseHlcVector(hlcVectorRaw);

    // Re-attach update handler
    engine.updateHandler = (update: Uint8Array) => {
      engine.persistUpdate(update);
    };
    doc.on("update", engine.updateHandler);

    return engine;
  }

  /**
   * Get full session snapshot for recovery/handoff.
   */
  getSnapshot(): SessionSnapshot {
    return {
      sessionId: this.sessionId,
      exerciseKey: this.exerciseKey,
      exerciseName: this.exerciseName,
      startTime: this.startTime,
      lastUpdate: this.yState.get("lastUpdate") || this.startTime,
      hlcVector: this.serializeHlcVector(),
      state: this.yState.toJSON() as Partial<EngineState>,
      repOps: this.yReps.toArray() as RepOperation[],
      compressedFrames: this.encodeState(),
    };
  }

  /**
   * Get all rep operations sorted by HLC (causal order).
   */
  getRepHistory(): RepOperation[] {
    const reps = this.yReps.toArray() as RepOperation[];
    return reps.sort((a, b) => compareHLC(a.hlc, b.hlc));
  }

  /**
   * Get current merged engine state.
   */
  getMergedState(): Partial<EngineState> {
    return this.yState.toJSON() as Partial<EngineState>;
  }

  destroy(): void {
    this.doc.off("update", this.updateHandler);
    this.doc.destroy();
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private serializeHlcVector(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [nodeId, hlc] of this.hlcVector) {
      result[nodeId] = hlcToString(hlc);
    }
    return result;
  }

  private parseHlcVector(raw: Record<string, string>): Map<string, HLCTimestamp> {
    const result = new Map<string, HLCTimestamp>();
    for (const [nodeId, hlcStr] of Object.entries(raw)) {
      result.set(nodeId, hlcFromString(hlcStr));
    }
    return result;
  }

  private async persistUpdate(update: Uint8Array): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(YJS_STORE, "readwrite");
      const store = tx.objectStore(YJS_STORE);

      // Append update to existing session record
      const getReq = store.get(this.sessionId);
      getReq.onsuccess = () => {
        const existing = getReq.result as { sessionId: string; updates: Uint8Array[] } | undefined;
        const updates = existing?.updates || [];
        updates.push(update);

        // Keep only last 100 updates to prevent unbounded growth
        if (updates.length > 100) {
          // Compact: encode full state as single update
          const compacted = Y.encodeStateAsUpdate(this.doc);
          store.put({ sessionId: this.sessionId, updates: [compacted] });
        } else {
          store.put({ sessionId: this.sessionId, updates });
        }
      };
    } catch (err) {
      console.error("[CRDT] Failed to persist update:", err);
    }
  }
}

// ─── Static Helpers ──────────────────────────────────────────────────────────

/**
 * Load a session from IndexedDB by sessionId.
 */
export async function loadSessionFromDB(sessionId: string): Promise<Uint8Array | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(YJS_STORE, "readonly");
      const store = tx.objectStore(YJS_STORE);
      const req = store.get(sessionId);
      req.onsuccess = () => {
        const result = req.result as { updates: Uint8Array[] } | undefined;
        if (!result || !result.updates.length) {
          resolve(null);
          return;
        }
        // Merge all updates into single state
        const doc = new Y.Doc();
        for (const update of result.updates) {
          Y.applyUpdate(doc, update);
        }
        resolve(Y.encodeStateAsUpdate(doc));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * List all active sessions in IndexedDB.
 */
export async function listActiveSessions(): Promise<{ sessionId: string; lastUpdate: number }[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(YJS_STORE, "readonly");
      const store = tx.objectStore(YJS_STORE);
      const req = store.openCursor();
      const sessions: { sessionId: string; lastUpdate: number }[] = [];

      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue | null;
        if (cursor) {
          const value = cursor.value as { sessionId: string; updates: Uint8Array[] };
          // Peek at last update time from first update's doc
          const doc = new Y.Doc();
          Y.applyUpdate(doc, value.updates[value.updates.length - 1]);
          const yState = doc.getMap("state");
          sessions.push({
            sessionId: value.sessionId,
            lastUpdate: (yState.get("lastUpdate") as number) || 0,
          });
          cursor.continue();
        } else {
          resolve(sessions);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Clear a session from IndexedDB.
 */
export async function clearSession(sessionId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(YJS_STORE, "readwrite");
      const req = tx.objectStore(YJS_STORE).delete(sessionId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[CRDT] Failed to clear session:", err);
  }
}

/**
 * Clear all sessions older than a threshold (ms).
 */
export async function clearOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
  const sessions = await listActiveSessions();
  const now = Date.now();
  for (const session of sessions) {
    if (now - session.lastUpdate > maxAgeMs) {
      await clearSession(session.sessionId);
    }
  }
}