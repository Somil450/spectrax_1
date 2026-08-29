import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeSelfMock() {
  return {
    onmessage: null as any,
    postMessage: vi.fn(),
    close: vi.fn(),
  };
}

beforeEach(() => {
  vi.stubGlobal("self", makeSelfMock());
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function postFrame(buf?: ArrayBuffer, extra: Record<string, any> = {}) {
  const selfMock = (globalThis as any).self;
  selfMock.onmessage({
    data: {
      type: "frame",
      frameId: 1,
      buf,
      ...extra,
    },
  });
}

function postTerminate() {
  const selfMock = (globalThis as any).self;
  selfMock.onmessage({ data: { type: "terminate" } });
}

describe("poseWorker terminate cleanup", () => {
  it("releases resources and self-closes when a terminate message arrives", async () => {
    await import("./poseWorker");

    postTerminate();

    expect((globalThis as any).self.close).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — repeated terminate/cleanup messages do not throw", async () => {
    await import("./poseWorker");

    postTerminate();
    (globalThis as any).self.onmessage({ data: { type: "cleanup" } });

    expect((globalThis as any).self.close).toHaveBeenCalledTimes(2);
  });

  it("keeps replying to frames after cleanup without crashing", async () => {
    const module = await import("./poseWorker");
    expect(module).toBeDefined();

    postTerminate();

    const buf = new ArrayBuffer(33 * 4 * 4);
    const view = new Float32Array(buf);
    for (let i = 0; i < 33; i++) {
      view[i * 4] = 0.5;
      view[i * 4 + 1] = 0.5;
      view[i * 4 + 2] = 0;
      view[i * 4 + 3] = 1;
    }
    postFrame(buf);

    const selfMock = (globalThis as any).self;
    expect(selfMock.postMessage).toHaveBeenCalled();
    const reply = selfMock.postMessage.mock.calls[0][0];
    expect(reply.frameId).toBe(1);
    expect(reply).toHaveProperty("angles");
  });
});
