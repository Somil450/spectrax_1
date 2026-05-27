const { registerPoseSocketHandlers } = require("../../../../src/modules/pose/pose.socket");

function createSocket() {
  const listeners = new Map();
  const emitted = [];

  return {
    id: "socket-1",
    on(event, handler) {
      listeners.set(event, handler);
    },
    emit(event, payload) {
      emitted.push({ event, payload });
    },
    trigger(event, payload) {
      const handler = listeners.get(event);
      if (handler) handler(payload);
    },
    emitted,
  };
}

describe("pose.socket", () => {
  it("ignores malformed frame payloads and emits acquisition feedback", () => {
    const socket = createSocket();
    const sessionService = {
      appendFrame: vi.fn(),
    };

    registerPoseSocketHandlers({ socket, sessionService });
    socket.trigger("frame", {
      landmarks: [],
      timestamp: Number.NaN,
      exercise: "burpee",
    });

    expect(sessionService.appendFrame).not.toHaveBeenCalled();
    expect(socket.emitted).toEqual([
      {
        event: "feedback",
        payload: {
          angles: {},
          corrections: [],
          status: "yellow",
          feedback: "Acquiring pose...",
          timestamp: null,
        },
      },
    ]);
  });

  describe("frame rate limiting", () => {
    it("blocks frames that exceed MAX_FRAMES_PER_SEC in one second", () => {
      const socket = createSocket();
      socket.id = "rate-limit-1";
      const sessionService = { appendFrame: vi.fn() };

      registerPoseSocketHandlers({ socket, sessionService });

      for (let i = 0; i < 60; i++) {
        socket.trigger("frame", {
          landmarks: [],
          timestamp: 0,
          exercise: "squat",
        });
      }

      expect(socket.emitted.length).toBe(60);

      socket.trigger("frame", {
        landmarks: [],
        timestamp: 0,
        exercise: "squat",
      });

      expect(socket.emitted.length).toBe(60);
    });

    it("resets rate limit after one second passes", () => {
      const socket = createSocket();
      socket.id = "rate-limit-2";
      const sessionService = { appendFrame: vi.fn() };

      vi.useFakeTimers();
      registerPoseSocketHandlers({ socket, sessionService });

      for (let i = 0; i < 60; i++) {
        socket.trigger("frame", {
          landmarks: [],
          timestamp: Date.now(),
          exercise: "squat",
        });
      }

      expect(socket.emitted.length).toBe(60);

      vi.advanceTimersByTime(1100);

      socket.trigger("frame", {
        landmarks: [],
        timestamp: Date.now(),
        exercise: "squat",
      });

      expect(socket.emitted.length).toBe(61);
      vi.useRealTimers();
    });

    it("cleans up frame timestamps on disconnect", () => {
      const socket = createSocket();
      socket.id = "rate-limit-3";
      const sessionService = { appendFrame: vi.fn() };

      registerPoseSocketHandlers({ socket, sessionService });

      for (let i = 0; i < 60; i++) {
        socket.trigger("frame", {
          landmarks: [],
          timestamp: 0,
          exercise: "squat",
        });
      }
      const emittedBefore = socket.emitted.length;

      socket.trigger("disconnect");

      registerPoseSocketHandlers({ socket, sessionService });

      socket.trigger("frame", {
        landmarks: [],
        timestamp: 0,
        exercise: "squat",
      });

      expect(socket.emitted.length).toBe(emittedBefore + 1);
    });
  });
});
