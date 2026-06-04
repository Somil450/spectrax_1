const express = require("express");
const request = require("supertest");
const { createApp } = require("../../src/app/createApp");
const { createSessionStore } = require("../../src/modules/session/session.store");
const setupHealthRoute = require("../../src/modules/healthRoute");
const { buildHealthPayload } = require("../../src/modules/health/health.utils");

function makeConfig(overrides = {}) {
  return {
    corsOrigin: "*",
    healthMonitorSecret: null,
    ...overrides,
  };
}

describe("health payload", () => {
  it("keeps metrics hidden unless the monitor secret matches", () => {
    const sessionStore = createSessionStore();
    sessionStore.initializeSession("socket-a");

    const publicPayload = buildHealthPayload(sessionStore, "top-secret", null);
    const privatePayload = buildHealthPayload(
      sessionStore,
      "top-secret",
      "top-secret",
    );

    expect(publicPayload).toEqual({ status: "ok" });
    expect(privatePayload.status).toBe("ok");
    expect(privatePayload.activeSessions).toBe(1);
    expect(typeof privatePayload.uptime).toBe("number");
  });
});

describe("health route", () => {
  it("returns only the public status by default", async () => {
    const sessionStore = createSessionStore();
    sessionStore.initializeSession("socket-a");
    sessionStore.initializeSession("socket-b");

    const app = createApp({ sessionStore, config: makeConfig() });
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("reveals metrics only when the monitor secret is provided", async () => {
    const sessionStore = createSessionStore();
    sessionStore.initializeSession("socket-a");
    sessionStore.initializeSession("socket-b");

    const app = createApp({
      sessionStore,
      config: makeConfig({ healthMonitorSecret: "top-secret" }),
    });

    const publicResponse = await request(app).get("/health");
    const privateResponse = await request(app)
      .get("/health")
      .set("X-Monitor-Secret", "top-secret");

    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body).toEqual({ status: "ok" });
    expect(privateResponse.status).toBe(200);
    expect(privateResponse.body.status).toBe("ok");
    expect(privateResponse.body.activeSessions).toBe(2);
    expect(typeof privateResponse.body.uptime).toBe("number");
  });

  it("keeps the legacy app bootstrap route aligned with the same guard", async () => {
    const sessionStore = new Map([
      ["socket-a", []],
      ["socket-b", []],
      ["socket-c", []],
    ]);
    const app = express();
    setupHealthRoute(app, sessionStore, "top-secret");

    const publicResponse = await request(app).get("/health");
    const privateResponse = await request(app)
      .get("/health")
      .set("X-Monitor-Secret", "top-secret");

    expect(publicResponse.body).toEqual({ status: "ok" });
    expect(privateResponse.body.activeSessions).toBe(3);
    expect(typeof privateResponse.body.uptime).toBe("number");
  });
});
