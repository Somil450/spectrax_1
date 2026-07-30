const { getHealth } = require("./health/health.controller");

function setupHealthRoute(app, sessions) {
  const sessionStore = {
    size: () => sessions.size,
    get: (id) => sessions.get(id),
    set: (id, data) => sessions.set(id, data),
    delete: (id) => sessions.delete(id),
  };

  app.get("/health", (req, res) => getHealth(req, res, sessionStore));
}

module.exports = setupHealthRoute;
