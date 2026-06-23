const { resolveClientIp } = require("../../../src/app/createServer");

function socketWith(address, forwarded) {
  return {
    handshake: {
      address,
      headers: forwarded ? { "x-forwarded-for": forwarded } : {},
    },
  };
}

describe("resolveClientIp", () => {
  it("returns the direct address when trustProxy is 0", () => {
    expect(resolveClientIp(socketWith("::1", "1.2.3.4"), 0)).toBe("::1");
  });

  it("returns the last forwarded address for one trusted hop", () => {
    expect(
      resolveClientIp(socketWith("10.0.0.1", "1.2.3.4, 5.6.7.8"), 1),
    ).toBe("5.6.7.8");
  });

  it("returns the client address for two trusted hops", () => {
    expect(
      resolveClientIp(socketWith("10.0.0.1", "1.2.3.4, 5.6.7.8"), 2),
    ).toBe("1.2.3.4");
  });

  it("falls back to the direct address when there is no forwarded header", () => {
    expect(resolveClientIp(socketWith("203.0.113.5"), 1)).toBe("203.0.113.5");
  });
});
