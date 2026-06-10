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

    describe("production warning", () => {
      const origEnv = process.env.NODE_ENV;

      beforeEach(() => {
        process.env.NODE_ENV = "production";
      });

      afterEach(() => {
        process.env.NODE_ENV = origEnv;
      });

      it("warns when origin is wildcard in production", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        createSocketOptions({ corsOrigin: "*", socketPath: "/socket.io" });
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
      });

      it("does not warn for specific origin in production", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        createSocketOptions({
          corsOrigin: "http://example.com",
          socketPath: "/socket.io",
        });
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
      });
    });
  });
});
