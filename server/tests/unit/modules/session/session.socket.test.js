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
});
