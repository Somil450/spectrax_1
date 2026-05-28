const path = require("path");
const { io: ioClient } = require("socket.io-client");

function clearSrcCache() {
  const srcDir = path.resolve(__dirname, "../../src");
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(srcDir)) {
      delete require.cache[key];
    }
  }
}

describe("socket auth", () => {
  afterEach(() => {
    clearSrcCache();
  });

  it("rejects connection when auth token is required but not provided", async () => {
    process.env.SOCKET_AUTH_TOKEN = "test-secret";
    const { createServer } = require("../../src/app/createServer");

    const runtime = createServer({
      port: 0,
      logger: { info() {}, error() {} },
    });

    await runtime.start();
    const address = runtime.server.address();

    const client = ioClient(`ws://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
    });

    const error = await new Promise((resolve) => {
      client.on("connect_error", resolve);
    });

    expect(error.message).toBe(
      "Authentication failed: invalid or missing token",
    );

    client.close();
    await runtime.shutdown();
  });

  it("accepts connection with valid auth token", async () => {
    process.env.SOCKET_AUTH_TOKEN = "test-secret";
    const { createServer } = require("../../src/app/createServer");

    const runtime = createServer({
      port: 0,
      logger: { info() {}, error() {} },
    });

    await runtime.start();
    const address = runtime.server.address();

    const client = ioClient(`ws://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
      auth: { token: "test-secret" },
    });

    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });

    client.close();
    await runtime.shutdown();
  });

  it("allows connection with a warning when SOCKET_AUTH_TOKEN is not set in development", async () => {
    delete process.env.SOCKET_AUTH_TOKEN;
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const warnings = [];
    const { createServer } = require("../../src/app/createServer");

    const runtime = createServer({
      port: 0,
      logger: { info(msg) { warnings.push(msg); }, error() {} },
    });

    await runtime.start();
    const address = runtime.server.address();

    const client = ioClient(`ws://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
    });

    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });

    expect(warnings.some((w) => w.includes("SOCKET_AUTH_TOKEN is not set"))).toBe(true);

    client.close();
    await runtime.shutdown();
    process.env.NODE_ENV = originalEnv;
  });

  it("rejects connection when SOCKET_AUTH_TOKEN is not set in production", async () => {
    delete process.env.SOCKET_AUTH_TOKEN;
    const originalEnv = process.env.NODE_ENV;
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
    });

    const error = await new Promise((resolve) => {
      client.on("connect_error", resolve);
    });

    expect(error.message).toBe(
      "Server misconfiguration: SOCKET_AUTH_TOKEN is not set",
    );

    client.close();
    await runtime.shutdown();
    process.env.NODE_ENV = originalEnv;
  });
});
