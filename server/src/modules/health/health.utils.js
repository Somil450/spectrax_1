function getSessionCount(sessionStore) {
  if (typeof sessionStore.size === "function") {
    return sessionStore.size();
  }

  if (typeof sessionStore.size === "number") {
    return sessionStore.size;
  }

  return 0;
}

function buildHealthPayload(sessionStore, monitorSecret, requestSecret) {
  const payload = {
    status: "ok",
  };

  if (!monitorSecret || requestSecret !== monitorSecret) {
    return payload;
  }

  return {
    ...payload,
    activeSessions: getSessionCount(sessionStore),
    uptime: Math.round(process.uptime()),
  };
}

module.exports = {
  buildHealthPayload,
  getSessionCount,
};
