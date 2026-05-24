const express = require("express");
const cors = require("cors");
const { getConfig } = require("../config/env");
const { createCorsOptions } = require("../config/cors");
const { createHealthRouter } = require("../modules/health/health.routes");

function createApp({ sessionStore, config = getConfig() }) {
  const app = express();

  app.use(cors(createCorsOptions(config)));
  app.use(express.json());
  app.use(createHealthRouter({ sessionStore }));

  return app;
}

module.exports = {
  createApp,
};
