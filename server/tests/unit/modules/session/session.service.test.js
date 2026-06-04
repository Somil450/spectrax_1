const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSessionService } = require('../../../../src/modules/session/session.service');
const { createSessionStore } = require('../../../../src/modules/session/session.store');

describe('session.service', () => {
  it('maintains a rolling buffer of frames per socket', () => {
    const store = createSessionStore();
    const service = createSessionService({
      sessionStore: store,
      sessionPath: path.join(os.tmpdir(), `spectrax-session-${Date.now()}.json`),
      maxSessionFrames: 2,
      logger: { info() {}, error() {} },
    });

    store.initializeSession('socket-1');
    service.appendFrame('socket-1', { timestamp: 1 });
    service.appendFrame('socket-1', { timestamp: 2 });
    service.appendFrame('socket-1', { timestamp: 3 });

    expect(store.getSessionFrames('socket-1')).toEqual([{ timestamp: 2 }, { timestamp: 3 }]);
  });

  it('writes a session payload to a socket-specific file and returns the path', async () => {
    const sessionPath = path.join(os.tmpdir(), `spectrax-session-${Date.now()}.json`);
    const store = createSessionStore();
    const service = createSessionService({
      sessionStore: store,
      sessionPath,
      maxSessionFrames: 3,
      logger: { info() {}, error() {} },
    });

    const savedPath = await service.saveSession([{ timestamp: 1 }], 'socket-9');
    expect(savedPath).toContain('socket-9');
    expect(savedPath).not.toBe(sessionPath);

    const saved = JSON.parse(fs.readFileSync(savedPath, 'utf8'));

    expect(saved.socketId).toBe('socket-9');
    expect(saved.frameCount).toBe(1);
    expect(saved.frames).toEqual([{ timestamp: 1 }]);
  });

  it('keeps finalize tracking isolated across service instances', async () => {
    const socketId = 'socket-shared';
    const sessionPathA = path.join(os.tmpdir(), `spectrax-session-a-${Date.now()}.json`);
    const sessionPathB = path.join(os.tmpdir(), `spectrax-session-b-${Date.now()}.json`);

    const storeA = createSessionStore();
    const storeB = createSessionStore();
    storeA.initializeSession(socketId);
    storeB.initializeSession(socketId);
    storeA.setSessionFrames(socketId, [{ timestamp: 1 }]);
    storeB.setSessionFrames(socketId, [{ timestamp: 2 }]);

    const serviceA = createSessionService({
      sessionStore: storeA,
      sessionPath: sessionPathA,
      maxSessionFrames: 3,
      logger: { info() {}, error() {} },
    });
    const serviceB = createSessionService({
      sessionStore: storeB,
      sessionPath: sessionPathB,
      maxSessionFrames: 3,
      logger: { info() {}, error() {} },
    });

    const framesA = await serviceA.finalizeSession(socketId);
    const framesB = await serviceB.finalizeSession(socketId);

    const savedA = JSON.parse(
      fs.readFileSync(`${sessionPathA.replace(/\.json$/, '')}-${socketId}.json`, 'utf8'),
    );
    const savedB = JSON.parse(
      fs.readFileSync(`${sessionPathB.replace(/\.json$/, '')}-${socketId}.json`, 'utf8'),
    );

    expect(framesA).toEqual([{ timestamp: 1 }]);
    expect(framesB).toEqual([{ timestamp: 2 }]);
    expect(savedA.frames).toEqual([{ timestamp: 1 }]);
    expect(savedB.frames).toEqual([{ timestamp: 2 }]);
  });
});
