import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { CRDTSessionEngine, type RepOperation } from "../crdtSessionEngine";
import { createRepIdempotencyKey, cyrb53 } from "../crdtIdempotencyKey";
import { reconcileDuplicateReps, validateRepInvariants } from "../crdtReconciliationEngine";
import type { EngineState } from "../exerciseEngine";

const BASE_STATE = (overrides: Partial<EngineState> = {}): EngineState =>
  ({
    reps: 0,
    totalReps: 0,
    correctReps: 0,
    stage: "up",
    repScores: [],
    repDeviations: [],
    feedback: "",
    mistakes: {},
    lastDepthResult: undefined,
    vbtMetrics: undefined,
    ...overrides,
  }) as EngineState;

function remoteUpdateWith(op: RepOperation): Uint8Array {
  const doc = new Y.Doc();
  const yReps = doc.getArray<RepOperation>("reps");
  yReps.push([op]);
  const yState = doc.getMap("state");
  yState.set("sessionId", "remote-session");
  yState.set("hlcVector", {});
  return Y.encodeStateAsUpdate(doc);
}

describe("cyrb53 / createRepIdempotencyKey", () => {
  it("is deterministic for identical inputs", () => {
    expect(createRepIdempotencyKey("squat", { timestamp: 1000, angles: { knee: 95 } }))
      .toBe(createRepIdempotencyKey("squat", { timestamp: 1000, angles: { knee: 95 } }));
  });

  it("differs when angles or timestamp change", () => {
    const base = createRepIdempotencyKey("squat", { timestamp: 1000, angles: { knee: 95 } });
    expect(createRepIdempotencyKey("squat", { timestamp: 1001, angles: { knee: 95 } })).not.toBe(base);
    expect(createRepIdempotencyKey("squat", { timestamp: 1000, angles: { knee: 96 } })).not.toBe(base);
    expect(createRepIdempotencyKey("lunge", { timestamp: 1000, angles: { knee: 95 } })).not.toBe(base);
  });

  it("is key-order independent for the same angle set", () => {
    expect(createRepIdempotencyKey("squat", { timestamp: 5, angles: { a: 1, b: 2 } }))
      .toBe(createRepIdempotencyKey("squat", { timestamp: 5, angles: { b: 2, a: 1 } }));
  });

  it("produces a stable 16-char hex string", () => {
    expect(cyrb53("hello")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("CRDTSessionEngine.recordRep", () => {
  it("appends a rep with an idempotency key", () => {
    const engine = new CRDTSessionEngine("squat", "Squat");
    const op = engine.recordRep(BASE_STATE({ reps: 1, totalReps: 1 }), { knee: 90 });
    expect(op.idempotencyKey).toBeDefined();
    expect(engine.getRepHistory()).toHaveLength(1);
  });

  it("skips re-appending the exact same rep within a transaction window", () => {
    const engine = new CRDTSessionEngine("squat", "Squat");
    const angles = { knee: 90 };
    const state = BASE_STATE({ reps: 1, totalReps: 1 });
    const first = engine.recordRep(state, angles);

    // Force an identical semantic rep (same key) — e.g. an offline re-record
    // that resolves to the same key — and ensure only one entry survives.
    const ySeen = (engine as unknown as { ySeen: Y.Map<number> }).ySeen;
    const op: RepOperation = { ...first, hlc: { nodeId: "r", wallTime: 1, counter: 1 } };
    engine.applyUpdate(remoteUpdateWith(op));
    expect(engine.getRepHistory()).toHaveLength(1);
    expect(ySeen.get(first.idempotencyKey!)).toBe(1);
  });
});

describe("CRDTSessionEngine.applyUpdate reconciliation", () => {
  it("drops a duplicate rep merged from a remote device", () => {
    const engine = new CRDTSessionEngine("squat", "Squat");
    const op = engine.recordRep(BASE_STATE({ reps: 1, totalReps: 1 }), { knee: 90 });

    // Simulate remote device re-syncing the identical rep (same key).
    engine.applyUpdate(remoteUpdateWith({ ...op, hlc: { nodeId: "r", wallTime: 1, counter: 1 } }));

    expect(engine.getRepHistory()).toHaveLength(1);
    expect(engine.getRepHistory()[0].idempotencyKey).toBe(op.idempotencyKey);
  });

  it("keeps genuinely distinct reps after merge", () => {
    const engine = new CRDTSessionEngine("squat", "Squat");
    engine.recordRep(BASE_STATE({ reps: 1, totalReps: 1 }), { knee: 90 });
    engine.recordRep(BASE_STATE({ reps: 2, totalReps: 2 }), { knee: 120 });

    // Remote has a distinct third rep.
    const remoteDoc = new Y.Doc();
    const remoteReps = remoteDoc.getArray<RepOperation>("reps");
    remoteReps.push([{
      hlc: { nodeId: "r", wallTime: 1, counter: 1 },
      repNumber: 3, totalReps: 3, correctReps: 3,
      repScore: 1, repDeviation: 0.1, stage: "up",
      angles: { knee: 135 }, feedback: "good", mistakes: {},
      timestamp: Date.now(),
      idempotencyKey: createRepIdempotencyKey("squat", { timestamp: Date.now(), repNumber: 3, angles: { knee: 135 } }),
    }]);
    const remoteState = remoteDoc.getMap("state");
    remoteState.set("sessionId", "remote");
    remoteState.set("hlcVector", {});
    engine.applyUpdate(Y.encodeStateAsUpdate(remoteDoc));

    expect(engine.getRepHistory()).toHaveLength(3);
  });

  it("handles rapid offline-online toggles without exploding the rep log", () => {
    const engine = new CRDTSessionEngine("squat", "Squat");
    const keys = new Set<string>();

    for (let cycle = 0; cycle < 5; cycle++) {
      const op = engine.recordRep(BASE_STATE({ reps: cycle + 1, totalReps: cycle + 1 }), { knee: 80 + cycle });
      keys.add(op.idempotencyKey!);
      // Every cycle re-syncs the full history plus one stale duplicate.
      engine.applyUpdate(engine.encodeState());
      engine.applyUpdate(remoteUpdateWith({ ...op, hlc: { nodeId: `dup-${cycle}`, wallTime: cycle + 10, counter: 1 } }));
    }

    expect(engine.getRepHistory().length).toBe(5);
    expect(new Set(engine.getRepHistory().map((r) => r.idempotencyKey)).size).toBe(5);
  });
});

describe("reconcileDuplicateReps / validateRepInvariants", () => {
  it("reconcileDuplicateReps removes duplicates and reports count", () => {
    const doc = new Y.Doc();
    const yReps = doc.getArray<RepOperation>("reps");
    const ySeen = doc.getMap<number>("repIdempotency");

    const base: RepOperation = {
      hlc: { nodeId: "r", wallTime: 1, counter: 1 },
      repNumber: 1, totalReps: 1, correctReps: 1,
      repScore: 1, repDeviation: 0.1, stage: "up",
      angles: { knee: 90 }, feedback: "ok", mistakes: {},
      timestamp: 100, idempotencyKey: "dup-key",
    };
    yReps.push([base, { ...base, hlc: { nodeId: "r", wallTime: 1, counter: 1 } }, {
      ...base,
      idempotencyKey: "unique-key",
      hlc: { nodeId: "r", wallTime: 1, counter: 1 },
    }]);

    let removed = 0;
    doc.transact(() => {
      removed = reconcileDuplicateReps(yReps, ySeen, "squat");
    });

    expect(removed).toBe(1);
    expect(yReps.length).toBe(2);
    expect(ySeen.size).toBe(2);
  });

  it("validateRepInvariants flags duplicates and clean logs pass", () => {
    const good = validateRepInvariants([
      { repNumber: 0, timestamp: 100 } as RepOperation,
      { repNumber: 1, timestamp: 200 } as RepOperation,
    ]);
    expect(good.valid).toBe(true);

    const dup = validateRepInvariants([
      { idempotencyKey: "k", timestamp: 100 } as RepOperation,
      { idempotencyKey: "k", timestamp: 200 } as RepOperation,
    ]);
    expect(dup.valid).toBe(false);
    expect(dup.errors.some((e) => e.includes("duplicate"))).toBe(true);
  });
});

