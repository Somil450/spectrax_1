const path = require("path");
const { io: ioClient } = require("socket.io-client");

require.cache[require.resolve("firebase-admin")] = {
  exports: {
    getApps: () => [],
    initializeApp: () => {},
    auth: () => ({
      verifyIdToken: (token) => {
        if (token === "valid-token") {
          return Promise.resolve({ uid: "test-user-id" });
        }
        throw new Error("Invalid token");
      }
    })
  }
};

const admin = require("firebase-admin");

function clearSrcCache() {
  const srcDir = path.resolve(__dirname, "../../src");
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(srcDir)) {
      delete require.cache[key];
    }
  }
}

describe("socket auth", () => {
  let originalEnv;
  let originalCors;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    originalCors = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = "https://yourapp.com";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalCors === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = originalCors;
    }
    clearSrcCache();
  });

  it("rejects connection when auth token is required but not provided in production", async () => {
    process.env.NODE_ENV = "production";
    const { createServer } = require("../../src/app/createServer");

    const runtime = createServer({
      port: 0,
      logger: { info() {}, error() {} },
    });

    await runtime.start();
    const address = runtime.server.address();

    const client = ioClient(`ws://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
      forceNew: true,
    });

    const error = await new Promise((resolve) => {
      client.on("connect_error", resolve);
    });

    expect(error.message).toBe(
      "Authentication failed: missing token",
    );

    client.close();
    await runtime.shutdown();
  });

  it("accepts connection with valid auth token", async () => {
    const { createServer } = require("../../src/app/createServer");

    const runtime = createServer({
      port: 0,
      logger: { info() {}, error() {} },
    });

    await runtime.start();
    const address = runtime.server.address();

    const client = ioClient(`ws://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
      auth: { token: "valid-token" },
      forceNew: true,
    });

    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });

    client.close();
    await runtime.shutdown();
  });

  it("rejects connection with invalid auth token", async () => {
    const { createServer } = require("../../src/app/createServer");

    const runtime = createServer({
      port: 0,
      logger: { info() {}, error() {} },
    });

    await runtime.start();
    const address = runtime.server.address();

    const client = ioClient(`ws://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
      auth: { token: "invalid-token" },
      forceNew: true,
    });

    const error = await new Promise((resolve) => {
      client.on("connect_error", resolve);
    });

    expect(error.message).toBe(
      "Authentication failed: invalid token",
    );

    client.close();
    await runtime.shutdown();
  });

  it("connects without auth when not in production and no token is provided", async () => {
    process.env.NODE_ENV = "development";
    const { createServer } = require("../../src/app/createServer");

    const runtime = createServer({
      port: 0,
      logger: { info() {}, error() {} },
    });

    await runtime.start();
    const address = runtime.server.address();

    const client = ioClient(`ws://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
      forceNew: true,
    });

    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });

    client.close();
    await runtime.shutdown();
  });
});
