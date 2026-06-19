/**
 * hybridLogicalClock.ts
 * HLC (Hybrid Logical Clock) implementation for causal ordering across devices.
 * Combines physical wall clock with monotonic logical counter.
 * Format: { wallTime: number, counter: number, nodeId: string }
 */

export interface HLCTimestamp {
  wallTime: number;   // Physical time in ms
  counter: number;    // Logical counter for same-wallTime events
  nodeId: string;     // Unique device identifier
}

const NODE_ID_KEY = "spectrax_hlc_node_id";

function getOrCreateNodeId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(NODE_ID_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(NODE_ID_KEY, id);
  }
  return id;
}

const localNodeId = getOrCreateNodeId();
let lastWallTime = 0;
let lastCounter = 0;

/**
 * Generate a new HLC timestamp.
 * Monotonic: never returns a timestamp earlier than the previous one.
 */
export function nowHLC(): HLCTimestamp {
  const wallTime = Math.max(Date.now(), lastWallTime);
  const counter = wallTime === lastWallTime ? lastCounter + 1 : 0;
  lastWallTime = wallTime;
  lastCounter = counter;
  return { wallTime, counter, nodeId: localNodeId };
}

/**
 * Compare two HLC timestamps.
 * Returns -1 if a < b, 0 if concurrent/equal, 1 if a > b.
 */
export function compareHLC(a: HLCTimestamp, b: HLCTimestamp): number {
  if (a.wallTime !== b.wallTime) {
    return a.wallTime < b.wallTime ? -1 : 1;
  }
  if (a.counter !== b.counter) {
    return a.counter < b.counter ? -1 : 1;
  }
  if (a.nodeId === b.nodeId) return 0;
  // Same wallTime + counter but different node = concurrent
  return a.nodeId < b.nodeId ? -1 : 1;
}

/**
 * Update local HLC state after receiving a remote timestamp.
 * Ensures next local timestamp is strictly greater than remote.
 */
export function updateHLC(remote: HLCTimestamp): void {
  const wallTime = Math.max(Date.now(), lastWallTime, remote.wallTime);
  let counter = 0;
  if (wallTime === lastWallTime && wallTime === remote.wallTime) {
    counter = Math.max(lastCounter, remote.counter) + 1;
  } else if (wallTime === lastWallTime) {
    counter = lastCounter + 1;
  } else if (wallTime === remote.wallTime) {
    counter = remote.counter + 1;
  }
  lastWallTime = wallTime;
  lastCounter = counter;
}

/**
 * Serialize HLC to compact string for storage/transfer.
 */
export function hlcToString(ts: HLCTimestamp): string {
  return `${ts.wallTime}:${ts.counter}:${ts.nodeId}`;
}

/**
 * Parse HLC from string.
 */
export function hlcFromString(str: string): HLCTimestamp {
  const [wallTime, counter, ...nodeIdParts] = str.split(":");
  return {
    wallTime: parseInt(wallTime, 10),
    counter: parseInt(counter, 10),
    nodeId: nodeIdParts.join(":"),
  };
}