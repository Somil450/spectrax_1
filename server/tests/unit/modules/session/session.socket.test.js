const { registerSessionSocketHandlers } = require('../../../../src/modules/session/session.socket');

function createSocket(id) {
  const listeners = new Map();

  return {
    id,
    on(event, handler) {
      listeners.set(event, handler);
    },
    async trigger(event) {
      return listeners.get(event)();
    },
  };
}

describe('session.socket', () => {
  it('skips finalization when the socket id is missing', async () => {
    const socket = createSocket('');
    const sessionService = {
      finalizeSession: vi.fn(),
    };

    registerSessionSocketHandlers({
      socket,
      sessionService,
      logger: { info() {} },
    });

    await socket.trigger('session:end');
    await socket.trigger('disconnect');

    expect(sessionService.finalizeSession).not.toHaveBeenCalled();
  });

  it('catches and logs a finalizeSession rejection instead of letting it escape the listener', async () => {
    const socket = createSocket('socket-7');
    const errors = [];
    const sessionService = {
      finalizeSession: vi.fn().mockRejectedValue(new Error('disk full')),
    };

    registerSessionSocketHandlers({
      socket,
      sessionService,
      logger: { info() {}, error: (...args) => errors.push(args) },
    });

    await expect(socket.trigger('session:end')).resolves.toBeUndefined();
    await expect(socket.trigger('disconnect')).resolves.toBeUndefined();

    expect(sessionService.finalizeSession).toHaveBeenCalledTimes(2);
    expect(errors).toHaveLength(2);
  });
});
