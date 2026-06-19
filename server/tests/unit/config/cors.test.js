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

    describe("production enforcement", () => {
      const origEnv = process.env.NODE_ENV;

      beforeEach(() => {
        process.env.NODE_ENV = "production";
      });

      afterEach(() => {
        process.env.NODE_ENV = origEnv;
      });

      it("throws when origin is wildcard in production", () => {
        expect(() => createCorsOptions({ corsOrigin: "*" })).toThrow(
          "CORS_ORIGIN is set to '*' in production",
        );
      });

      it("does not throw for specific origin in production", () => {
        expect(() =>
          createCorsOptions({ corsOrigin: "http://example.com" }),
        ).not.toThrow();
      });
    });
  });
});
