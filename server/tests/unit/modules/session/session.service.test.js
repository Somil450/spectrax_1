const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSessionService } = require('../../../../src/modules/session/session.service');
const { createSessionStore } = require('../../../../src/modules/session/session.store');

describe('session.service', () => {
  const sessionPath = path.join(os.tmpdir(), `spectrax-session-${Date.now()}.json`);

  function withService(maxSessionFrames = 3) {
    const store = createSessionStore();
    const service = createSessionService({
      sessionStore: store,
      sessionPath,
      maxSessionFrames,
      logger: { info() {}, error() {} },
    });
    return { store, service };
  }

  it('maintains a rolling buffer of frames per socket', () => {
    const { store, service } = withService(2);

    store.initializeSession('socket-1');
    service.appendFrame('socket-1', { timestamp: 1 });
    service.appendFrame('socket-1', { timestamp: 2 });
    service.appendFrame('socket-1', { timestamp: 3 });

    expect(store.getSessionFrames('socket-1')).toEqual([{ timestamp: 2 }, { timestamp: 3 }]);
  });

  it('writes a session payload to a socket-specific file and returns the path', async () => {
    const { store, service } = withService(3);

    const savedPath = await service.saveSession([{ timestamp: 1 }], 'socket-9');
    expect(savedPath).toContain('socket-9');
    expect(savedPath).not.toBe(sessionPath);

    const saved = JSON.parse(fs.readFileSync(savedPath, 'utf8'));

    expect(saved.socketId).toBe('socket-9');
    expect(saved.frameCount).toBe(1);
    expect(saved.frames).toEqual([{ timestamp: 1 }]);
  });

  it('saves a defensive copy so concurrent frame mutations do not corrupt persisted data', async () => {
    const { store, service } = withService(100);

    store.initializeSession('socket-race');
    service.appendFrame('socket-race', { ts: 1, label: 'a' });
    service.appendFrame('socket-race', { ts: 2, label: 'b' });

    const framesRef = store.getSessionFrames('socket-race');
    const writeFileOrig = fs.promises.writeFile;
    let capturedArg = null;

    vi.spyOn(fs.promises, 'writeFile').mockImplementation(async (filePath, data) => {
      capturedArg = JSON.parse(data);
      return writeFileOrig.call(fs.promises, filePath, data);
    });

    await service.finalizeSession('socket-race');

    expect(capturedArg).not.toBeNull();
    expect(capturedArg.frames).not.toBe(framesRef);
    expect(capturedArg.frames).toEqual([
      { ts: 1, label: 'a' },
      { ts: 2, label: 'b' },
    ]);
    expect(capturedArg.frameCount).toBe(2);

    vi.restoreAllMocks();
  });

  it('prevents double-save when finalizeSession is called concurrently', async () => {
    const { store, service } = withService(10);

    store.initializeSession('socket-double');
    service.appendFrame('socket-double', { timestamp: 1 });

    const writeFileOrig = fs.promises.writeFile;
    let writeCount = 0;

    vi.spyOn(fs.promises, 'writeFile').mockImplementation(async (filePath, data) => {
      writeCount++;
      await new Promise(r => setTimeout(r, 10));
      return writeFileOrig.call(fs.promises, filePath, data);
    });

    const [result1, result2] = await Promise.all([
      service.finalizeSession('socket-double'),
      service.finalizeSession('socket-double'),
    ]);

    expect(writeCount).toBe(1);
    expect(result1.length).toBe(1);
    expect(result2.length).toBe(0);

    vi.restoreAllMocks();
  });
});
