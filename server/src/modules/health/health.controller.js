function getHealth(_req, res, sessionStore) {
  res.json({
    status: "ok",
    activeSessions: sessionStore.size(),
    uptime: Math.round(process.uptime()),
  });
}

module.exports = {
  getHealth,
};
