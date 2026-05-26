const {
  hasSessionFrames,
  hasSocketId,
} = require('../../../../src/modules/session/session.validator');

describe('session.validator', () => {
  it('checks whether a session contains frames', () => {
    expect(hasSessionFrames([{ timestamp: 1 }])).toBe(true);
    expect(hasSessionFrames([])).toBe(false);
  });

  it('checks whether a socket id is present', () => {
    expect(hasSocketId('socket-1')).toBe(true);
    expect(hasSocketId('')).toBe(false);
  });
});
