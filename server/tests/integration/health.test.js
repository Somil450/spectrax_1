const request = require('supertest');
const { createApp } = require('../../src/app/createApp');
const { createSessionStore } = require('../../src/modules/session/session.store');

describe('health route', () => {
  it('returns backend health details', async () => {
    const sessionStore = createSessionStore();
    sessionStore.initializeSession('socket-a');
    sessionStore.initializeSession('socket-b');

    const app = createApp({ sessionStore });
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.activeSessions).toBe(2);
    expect(typeof response.body.uptime).toBe('number');
  });
});
