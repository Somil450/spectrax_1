const express = require("express");
const cors = require("cors");
const { getConfig } = require("../config/env");
const { createCorsOptions } = require("../config/cors");
const { PAYLOAD_LIMIT } = require("../config/constants");
const { createHealthRouter } = require("../modules/health/health.routes");

function createSecurityHeaders() {
  return (_, res, next) => {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
    next();
  };
}

function createApp({ sessionStore, config = getConfig() }) {
  const app = express();

  app.use(createSecurityHeaders());
  app.use(cors(createCorsOptions(config)));
  app.use(express.json({ limit: PAYLOAD_LIMIT }));
  app.use(createHealthRouter({ sessionStore }));

  return app;
}

module.exports = {
  createApp,
};
