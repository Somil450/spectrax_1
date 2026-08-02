import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockPose {
  static instances: MockPose[] = [];
  options: any = null;
  constructor(_config: any) {
    MockPose.instances.push(this);
  }
  setOptions(options: any) {
    this.options = options;
  }
  onResults(_cb: any) {
    return this;
  }
  async send(_input: any) {
    return Promise.resolve();
  }
  async close() {
    return Promise.resolve();
  }
}

// MediaPipe Pose is loaded from window.Pose (UMD bundle in index.html). It must
// be stubbed before the poseService module is evaluated so the singleton
// constructor picks up the mock instead of falling back to simulated mode.
beforeEach(() => {
  vi.stubGlobal("Pose", MockPose);
  vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContext {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as any);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  MockPose.instances = [];
});

describe("poseService close + lazy re-init", () => {
  it("close() nullifies the MediaPipe pose object and releases isLoaded", async () => {
    const { poseService } = await import("./poseService");
    const instancesAfterInit = MockPose.instances.length;

    expect(instancesAfterInit).toBeGreaterThan(0);

    await poseService.close();

    expect(MockPose.instances.length).toBe(instancesAfterInit);
    expect((poseService as any).pose).toBeNull();
    expect((poseService as any).isLoaded).toBe(false);
  });

  it("send() lazily re-initializes the detector after close() and reuses it", async () => {
    const { poseService } = await import("./poseService");
    const instancesAfterInit = MockPose.instances.length;

    await poseService.close();

    await poseService.send({} as any);
    expect(MockPose.instances.length).toBe(instancesAfterInit + 1);
    expect((poseService as any).pose).not.toBeNull();

    // A second send must not create a third detector instance.
    await poseService.send({} as any);
    expect(MockPose.instances.length).toBe(instancesAfterInit + 1);
  });

  it("close() is idempotent and safe when the detector is already released", async () => {
    const { poseService } = await import("./poseService");

    await poseService.close();
    await poseService.close();

    expect((poseService as any).pose).toBeNull();
  });
});
