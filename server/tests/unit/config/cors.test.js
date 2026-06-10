const { createCorsOptions } = require("../../../src/config/cors");

describe("cors config", () => {
  describe("createCorsOptions", () => {
    it("returns wildcard origin for * config", () => {
      const result = createCorsOptions({ corsOrigin: "*" });
      expect(result).toEqual({ origin: "*" });
    });

    it("parses single origin", () => {
      const result = createCorsOptions({
        corsOrigin: "http://example.com",
      });
      expect(result).toEqual({ origin: ["http://example.com"] });
    });

    it("parses comma-separated origins", () => {
      const result = createCorsOptions({
        corsOrigin: "http://a.com, http://b.com",
      });
      expect(result).toEqual({
        origin: ["http://a.com", "http://b.com"],
      });
    });

    it("filters empty entries", () => {
      const result = createCorsOptions({
        corsOrigin: "http://a.com,, http://b.com",
      });
      expect(result).toEqual({
        origin: ["http://a.com", "http://b.com"],
      });
    });

    it("defaults to wildcard for undefined corsOrigin", () => {
      const result = createCorsOptions({});
      expect(result).toEqual({ origin: "*" });
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
        createCorsOptions({ corsOrigin: "*" });
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
      });

      it("does not warn for specific origin in production", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        createCorsOptions({ corsOrigin: "http://example.com" });
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
      });
    });
  });
});
