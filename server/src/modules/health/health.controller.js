function isLoopbackIp(ip) {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    (typeof ip === "string" && ip.startsWith("127."))
  );
}

function getHealth(req, res, sessionStore) {
  const healthSecret = process.env.HEALTH_SECRET_TOKEN;
  const isLocalhost = isLoopbackIp(req.ip);
  const authHeader = req.get("Authorization") || "";
  const isAuthorized = healthSecret && authHeader === `Bearer ${healthSecret}`;

  const baseHealth = {
    status: "ok",
  };

  // Return full metrics only for authenticated requests or localhost
  if (isAuthorized || isLocalhost) {
    return res.json({
      ...baseHealth,
      activeSessions: sessionStore.size(),
      uptime: Math.round(process.uptime()),
    });
  }

  // Unauthenticated remote callers get minimal response
  res.json(baseHealth);
}

module.exports = {
  getHealth,
};
