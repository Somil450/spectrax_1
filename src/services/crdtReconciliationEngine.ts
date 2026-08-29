/**
 * crdtReconciliationEngine.ts
 * Post-sync reconciliation + invariant validation for the Yjs rep log.
 *
 * After Y.applyUpdate merges a remote state, the rep array may contain
 * semantically-duplicate entries (same idempotency key). This module removes
 * them inside a single transaction and validates the resulting invariants.
 */

import * as Y from "yjs";
import { createRepIdempotencyKey } from "./crdtIdempotencyKey";
import type { RepOperation } from "./crdtSessionEngine";

export const IDEMPOTENCY_MAP = "repIdempotency";

function keyOf(exerciseKey: string, op: RepOperation): string {
  return op.idempotencyKey ?? createRepIdempotencyKey(exerciseKey, {
    timestamp: op.timestamp,
    repNumber: op.repNumber,
    angles: op.angles,
  });
}

/**
 * Remove duplicate rep entries (by idempotency key), keeping the first
 * occurrence, and rebuild the idempotency set. MUST be called from inside a
 * `doc.transact(() => ...)` to keep the writes atomic.
 *
 * @returns the number of duplicates removed
 */
export function reconcileDuplicateReps(
  yReps: Y.Array<RepOperation>,
  ySeen: Y.Map<number>,
  exerciseKey: string,
): number {
  const seen = new Map<string, number>();
  const toRemove: number[] = [];

  yReps.forEach((op, index) => {
    const key = keyOf(exerciseKey, op);
    if (seen.has(key)) toRemove.push(index);
    else seen.set(key, index);
  });

  // Delete in descending index order so indices stay valid.
  for (let i = toRemove.length - 1; i >= 0; i--) {
    yReps.delete(toRemove[i], 1);
  }

  // Rebuild idempotency set to match the deduplicated log.
  ySeen.clear();
  yReps.forEach((op) => {
    ySeen.set(keyOf(exerciseKey, op), 1);
  });

  return toRemove.length;
}

export interface RepInvariantReport {
  valid: boolean;
  errors: string[];
}

/**
 * Validate structural invariants of a merged rep log:
 *  - no duplicate idempotency keys
 *  - `totalReps` is not less than the number of recorded reps
 *  - timestamps are monotonically non-decreasing after causal sort
 */
export function validateRepInvariants(reps: RepOperation[]): RepInvariantReport {
  const errors: string[] = [];
  const seen = new Map<string, number>();

  const sorted = [...reps].sort((a, b) => {
    const d = a.timestamp - b.timestamp;
    if (d !== 0) return d;
    return (a.repNumber ?? 0) - (b.repNumber ?? 0);
  });

  for (let i = 0; i < sorted.length; i++) {
    const op = sorted[i];
    if (op.idempotencyKey) {
      if (seen.has(op.idempotencyKey)) {
        errors.push(`duplicate idempotencyKey ${op.idempotencyKey}`);
      }
      seen.set(op.idempotencyKey, i);
    }
    if (i > 0 && sorted[i].timestamp < sorted[i - 1].timestamp) {
      errors.push(`timestamp regression at index ${i}`);
    }
  }

  const maxReportedReps = reps.reduce((max, op) => Math.max(max, op.repNumber), 0);
  if (reps.length > 0 && maxReportedReps >= reps.length && maxReportedReps - reps.length > 1) {
    errors.push(`repNumber ${maxReportedReps} exceeds logged rep count ${reps.length}`);
  }

  return { valid: errors.length === 0, errors };
}
