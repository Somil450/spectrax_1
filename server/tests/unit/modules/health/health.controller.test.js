const { getHealth } = require("../../../../src/modules/health/health.controller");

function mockReq({ ip, hostname, authorization, monitorSecret }) {
  return {
    ip,
    hostname,
    get(header) {
      if (header === "Authorization") return authorization || "";
      if (header === "X-Monitor-Secret") return monitorSecret || "";
      return "";
    },
  };
}

function captureRes() {
  return {
    body: undefined,
    json(payload) {
      this.body = payload;
    },
  };
}

describe("getHealth", () => {
  const ORIGINAL_SECRET = process.env.HEALTH_SECRET_TOKEN;

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.HEALTH_SECRET_TOKEN;
    } else {
      process.env.HEALTH_SECRET_TOKEN = ORIGINAL_SECRET;
    }
  });

  it("returns full metrics for a loopback caller", () => {
    const res = captureRes();
    getHealth(mockReq({ ip: "127.0.0.1" }), res, { size: () => 3 });
    expect(res.body.status).toBe("ok");
    expect(res.body.activeSessions).toBe(3);
    expect(typeof res.body.uptime).toBe("number");
  });

  it("does not leak metrics to a remote caller spoofing Host: localhost", () => {
    const res = captureRes();
    getHealth(mockReq({ ip: "203.0.113.10", hostname: "localhost" }), res, {
      size: () => 3,
    });
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns full metrics for a valid health secret", () => {
    process.env.HEALTH_SECRET_TOKEN = "s3cret";
    const res = captureRes();
    getHealth(
      mockReq({ ip: "203.0.113.10", authorization: "Bearer s3cret" }),
      res,
      { size: () => 7 },
    );
    expect(res.body.activeSessions).toBe(7);
  });

  it("returns full metrics for a valid X-Monitor-Secret header", () => {
    process.env.HEALTH_MONITOR_SECRET = "mon-secret";
    const res = captureRes();
    getHealth(
      mockReq({ ip: "203.0.113.10", monitorSecret: "mon-secret" }),
      res,
      { size: () => 7 },
    );
    expect(res.body.activeSessions).toBe(7);
    expect(typeof res.body.uptime).toBe("number");
  });

  it("does not leak metrics to a remote caller with a wrong X-Monitor-Secret", () => {
    process.env.HEALTH_MONITOR_SECRET = "mon-secret";
    const res = captureRes();
    getHealth(
      mockReq({ ip: "203.0.113.10", monitorSecret: "wrong" }),
      res,
      { size: () => 7 },
    );
    expect(res.body).toEqual({ status: "ok" });
  });

  it("does not leak metrics when no secret is configured", () => {
    delete process.env.HEALTH_SECRET_TOKEN;
    delete process.env.HEALTH_MONITOR_SECRET;
    const res = captureRes();
    getHealth(
      mockReq({ ip: "203.0.113.10", monitorSecret: "mon-secret" }),
      res,
      { size: () => 7 },
    );
    expect(res.body).toEqual({ status: "ok" });
  });
});
