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
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), interest-cohort=()");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws: wss: https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com; img-src 'self' data: blob: https://*.googleusercontent.com; media-src 'self' blob: data: https://cdn.jsdelivr.net; frame-src 'self' https://*.firebaseapp.com; object-src 'none';"
    );
    next();
  };
}

function createApp({ sessionStore, config = getConfig() }) {
  const app = express();

  if (config.trustProxy > 0) {
    app.set("trust proxy", config.trustProxy);
  }

  app.use(createSecurityHeaders());
  app.use(cors(createCorsOptions(config)));
  app.use(express.json({ limit: PAYLOAD_LIMIT }));
  app.use(createSecurityHeaders());
  app.use(createHealthRouter({ sessionStore }));

  return app;
}

module.exports = {
  createApp,
};
