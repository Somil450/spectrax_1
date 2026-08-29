/**
 * crdtIdempotencyKey.ts
 * Deterministic, collision-resistant idempotency keys for CRDT rep operations.
 *
 * Yjs's Y.Array merges by insertion order and never deduplicates by semantic
 * identity: if the same rep (same timestamp + angles) is recorded locally
 * while offline and then merged again from a remote device during sync, Yjs
 * treats them as two distinct insertions. These keys let us detect and drop
 * such duplicates (see crdtSessionEngine.ts / crdtReconciliationEngine.ts).
 */

export interface RepIdempotencyInput {
  timestamp: number;
  repNumber?: number;
  angles?: Record<string, number>;
  [key: string]: unknown;
}

/**
 * cyrb53 — fast, stable 53-bit string hash (public-domain, by bryc).
 * Returns a hex string so it is safe to use directly as a Y.Map key.
 */
export function cyrb53(str: string, seed: number = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).padStart(16, "0");
}

function normalizeAngles(angles?: Record<string, number>): string {
  if (!angles) return "";
  return Object.entries(angles)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}:${Number.isFinite(v) ? v.toFixed(3) : "NaN"}`)
    .join("|");
}

/**
 * Deterministic idempotency key for a rep operation. Same input → same key,
 * while distinct reps differ with high probability.
 */
export function createRepIdempotencyKey(exerciseKey: string, input: RepIdempotencyInput): string {
  const parts = [
    exerciseKey,
    String(input.timestamp),
    String(input.repNumber ?? ""),
    normalizeAngles(input.angles as Record<string, number>),
  ];
  return cyrb53(parts.join("::"));
}
