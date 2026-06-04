const { buildHealthPayload } = require("./health/health.utils");

function setupHealthRoute(app, sessions, monitorSecret = null) {
  app.get("/health", (req, res) => {
    res.json(
      buildHealthPayload(sessions, monitorSecret, req.get("x-monitor-secret")),
    );
  });
}

module.exports = setupHealthRoute;
