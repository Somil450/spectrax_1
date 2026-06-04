function buildHealthPayload(sessionStore, monitorSecret, requestSecret) {
  const payload = {
    status: "ok",
  };

  if (!monitorSecret || requestSecret !== monitorSecret) {
    return payload;
  }

  return {
    ...payload,
    activeSessions: sessionStore.size(),
    uptime: Math.round(process.uptime()),
  };
}

module.exports = {
  buildHealthPayload,
};
