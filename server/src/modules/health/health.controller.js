const { buildHealthPayload } = require("./health.utils");

function getHealth(req, res, sessionStore, monitorSecret) {
  res.json(
    buildHealthPayload(sessionStore, monitorSecret, req.get("x-monitor-secret")),
  );
}

module.exports = {
  getHealth,
};
