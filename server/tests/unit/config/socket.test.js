const { createSocketOptions } = require("../../../src/config/socket");

describe("socket config", () => {
  describe("createSocketOptions", () => {
    it("returns options with expected shape", () => {
      const config = { corsOrigin: "*", socketPath: "/socket.io" };
      const result = createSocketOptions(config);
      expect(result).toMatchObject({
        cors: { origin: "*", methods: ["GET", "POST"] },
        pingInterval: 5000,
        pingTimeout: 3000,
        transports: ["websocket"],
        path: "/socket.io",
      });
    });

    it("parses single cors origin", () => {
      const result = createSocketOptions({
        corsOrigin: "http://example.com",
        socketPath: "/socket.io",
      });
      expect(result.cors.origin).toEqual(["http://example.com"]);
    });

    it("parses comma-separated cors origins", () => {
      const result = createSocketOptions({
        corsOrigin: "http://a.com, http://b.com",
        socketPath: "/socket.io",
      });
      expect(result.cors.origin).toEqual(["http://a.com", "http://b.com"]);
    });

    it("defaults to wildcard origin", () => {
      const result = createSocketOptions({
        socketPath: "/socket.io",
      });
      expect(result.cors.origin).toBe("*");
    });

    describe("production enforcement", () => {
      const origEnv = process.env.NODE_ENV;

      beforeEach(() => {
        process.env.NODE_ENV = "production";
      });

      afterEach(() => {
        process.env.NODE_ENV = origEnv;
      });

      it("throws when origin is wildcard in production", () => {
        expect(() =>
          createSocketOptions({ corsOrigin: "*", socketPath: "/socket.io" }),
        ).toThrow("Socket.IO CORS_ORIGIN is set to '*' in production");
      });

      it("does not throw for specific origin in production", () => {
        expect(() =>
          createSocketOptions({
            corsOrigin: "http://example.com",
            socketPath: "/socket.io",
          }),
        ).not.toThrow();
      });
    });
  });
});
