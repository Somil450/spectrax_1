import { describe, it, expect, beforeEach } from "vitest";

// ── Worker harness ───────────────────────────────────────────────────────────
// The poseWorker module assigns `self.onmessage` at import time and replies via
// `(self as any).postMessage`. We install a stub `self` BEFORE the worker module
// is (dynamically) imported so both paths hit the stub.
const replies: Array<{ msg: any; transfer?: Transferable[] }> = [];

const selfStub: any = {
  onmessage: null,
  postMessage: (msg: any, transfer?: Transferable[]) => {
    replies.push({ msg, transfer });
  },
};

Object.defineProperty(globalThis, "self", {
  value: selfStub,
  writable: true,
  configurable: true,
});

const LM_COUNT = 33;
const LM_STRIDE = 4;

const packLandmarks = (landmarks: Array<[number, number, number, number]>) => {
  const buf = new ArrayBuffer(LM_COUNT * LM_STRIDE * 4);
  const view = new Float32Array(buf);
  for (let i = 0; i < LM_COUNT; i++) {
    const o = i * LM_STRIDE;
    view[o] = landmarks[i]?.[0] ?? 0;
    view[o + 1] = landmarks[i]?.[1] ?? 0;
    view[o + 2] = landmarks[i]?.[2] ?? 0;
    view[o + 3] = landmarks[i]?.[3] ?? 0;
  }
  return buf;
};

const buildStandingPose = (): Array<[number, number, number, number]> => {
  const yFor = (i: number): number => {
    if (i <= 10) return 0.15; // head / face
    if (i <= 22) return 0.32; // shoulders, arms, hands
    if (i <= 24) return 0.5; // hips
    if (i <= 26) return 0.66; // knees
    return 0.82; // ankles / feet
  };
  const pose: Array<[number, number, number, number]> = [];
  for (let i = 0; i < LM_COUNT; i++) {
    pose.push([0.5, yFor(i), 0, 1]);
  }
  return pose;
};

describe("poseWorker OffscreenCanvas + zero-copy frames (#59)", () => {
  let handler: ((event: any) => void) | null = null;

  beforeEach(async () => {
    replies.length = 0;
    if (!handler) {
      await import("./poseWorker");
      handler = selfStub.onmessage;
    }
    expect(handler).toBeTypeOf("function");
  });

  it("reports a supported OffscreenCanvas 2D context on initCanvas", () => {
    const fakeCanvas = {
      getContext: () => ({ canvas: { width: 640, height: 480 } }),
    };
    handler!({ data: { type: "initCanvas", canvas: fakeCanvas } });

    const reply = replies[replies.length - 1].msg;
    expect(reply.type).toBe("canvasReady");
    expect(reply.supported).toBe(true);
    expect(reply.width).toBe(640);
    expect(reply.height).toBe(480);
  });

  it("reports unsupported when no 2D context can be acquired", () => {
    const fakeCanvas = { getContext: () => null };
    handler!({ data: { type: "initCanvas", canvas: fakeCanvas } });

    const reply = replies[replies.length - 1].msg;
    expect(reply.type).toBe("canvasReady");
    expect(reply.supported).toBe(false);
    expect(reply.width).toBe(0);
  });

  it("computes angles from a zero-copy landmark buffer and transfers it back", () => {
    const buf = packLandmarks(buildStandingPose());
    handler!({
      data: {
        buf,
        frameId: 7,
        status: "green",
        primaryJoints: [],
        t0: 100,
      },
    });

    const last = replies[replies.length - 1];
    expect(last.msg.angles).toBeTruthy();
    expect(typeof last.msg.detectedExercise).toBe("string");
    expect(last.msg.frameId).toBe(7);
    expect(typeof last.msg.ipcMs).toBe("number");
    // The landmark buffer must come back through the transfer list, not a clone
    expect(last.transfer).toContain(buf);
    expect(last.msg.buf).toBe(buf);
  });

  it("keeps the angle pipeline warm across consecutive zero-copy frames", () => {
    const buf1 = packLandmarks(buildStandingPose());
    const buf2 = packLandmarks(buildStandingPose());
    handler!({ data: { buf: buf1, frameId: 1, primaryJoints: [], t0: 0 } });
    handler!({ data: { buf: buf2, frameId: 2, primaryJoints: [], t0: 1 } });

    const frames = replies.filter((r) => r.msg.frameId !== undefined);
    expect(frames).toHaveLength(2);
    expect(frames[0].msg.detectedExercise).toBe(frames[1].msg.detectedExercise);
  });
});
