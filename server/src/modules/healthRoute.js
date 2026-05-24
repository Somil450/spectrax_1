function setupHealthRoute(app, sessions) {
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      activeSessions: sessions.size,
      uptime: Math.round(process.uptime()),
    });
  });
}

module.exports = setupHealthRoute;
