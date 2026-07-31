const fs = require('fs');
const path = require('path');
const { saveSession } = require('../../../src/modules/sessionStorage');
const { SESSIONS_DIR } = require('../../../src/config/constants');

describe('sessionStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves session frames asynchronously to the sessions directory', async () => {
    const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue();
    const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue();

    await saveSession([{ timestamp: 1 }, { timestamp: 2 }], 'socket-42');

    expect(mkdirSpy).toHaveBeenCalledWith(SESSIONS_DIR, { recursive: true });
    expect(writeSpy).toHaveBeenCalledTimes(1);

    const [filePath, content] = writeSpy.mock.calls[0];
    expect(filePath).toContain(path.join(SESSIONS_DIR, 'session-socket-42-'));
    const saved = JSON.parse(content);
    expect(saved.socketId).toBe('socket-42');
    expect(saved.frameCount).toBe(2);
    expect(saved.frames).toEqual([{ timestamp: 1 }, { timestamp: 2 }]);
  });

  it('sanitizes unsafe characters from the socket id in the filename', async () => {
    const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue();
    vi.spyOn(fs.promises, 'mkdir').mockResolvedValue();

    await saveSession([], 'a/b:c d');

    expect(writeSpy.mock.calls[0][0]).toContain('session-a_b_c_d-');
  });

  it('logs an error and does not throw when the write fails', async () => {
    vi.spyOn(fs.promises, 'writeFile').mockRejectedValue(
      new Error('disk full'),
    );
    vi.spyOn(fs.promises, 'mkdir').mockResolvedValue();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      saveSession([{ timestamp: 1 }], 'socket-7'),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save session'),
      'disk full',
    );
  });
});
