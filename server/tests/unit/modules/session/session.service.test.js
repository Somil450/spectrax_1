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

  it('deletes only old session files and leaves other files untouched', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spectrax-cleanup-'));
    const sessionPath = path.join(dir, 'session.json');
    const store = createSessionStore();
    const service = createSessionService({
      sessionStore: store,
      sessionPath,
      maxSessionFrames: 3,
      logger: { info() {}, error() {} },
    });
    service.stopCleanupRoutine();

    const oldSession = path.join(dir, 'session-old.json');
    const recentSession = path.join(dir, 'session-recent.json');
    const otherFile = path.join(dir, 'keep-me.txt');
    fs.writeFileSync(oldSession, '{}');
    fs.writeFileSync(recentSession, '{}');
    fs.writeFileSync(otherFile, 'important');

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldSession, tenDaysAgo, tenDaysAgo);
    fs.utimesSync(otherFile, tenDaysAgo, tenDaysAgo);

    await service.cleanupOldSessions();

    expect(fs.existsSync(oldSession)).toBe(false);
    expect(fs.existsSync(recentSession)).toBe(true);
    expect(fs.existsSync(otherFile)).toBe(true);
  });
});
