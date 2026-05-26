const { registerPoseSocketHandlers } = require('../../../../src/modules/pose/pose.socket');

function createSocket() {
  const listeners = new Map();
  const emitted = [];

  return {
    id: 'socket-1',
    on(event, handler) {
      listeners.set(event, handler);
    },
    emit(event, payload) {
      emitted.push({ event, payload });
    },
    trigger(event, payload) {
      listeners.get(event)(payload);
    },
    emitted,
  };
}

describe('pose.socket', () => {
  it('ignores malformed frame payloads and emits acquisition feedback', () => {
    const socket = createSocket();
    const sessionService = {
      appendFrame: vi.fn(),
    };

    registerPoseSocketHandlers({ socket, sessionService });
    socket.trigger('frame', {
      landmarks: [],
      timestamp: Number.NaN,
      exercise: 'burpee',
    });

    expect(sessionService.appendFrame).not.toHaveBeenCalled();
    expect(socket.emitted).toEqual([
      {
        event: 'feedback',
        payload: {
          angles: {},
          corrections: [],
          status: 'yellow',
          feedback: 'Acquiring pose...',
          timestamp: null,
        },
      },
    ]);
  });
});
