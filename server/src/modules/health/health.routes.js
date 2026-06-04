const express = require("express");
const { getHealth } = require("./health.controller");

function createHealthRouter({ sessionStore, monitorSecret }) {
  const router = express.Router();

  router.get("/health", (req, res) =>
    getHealth(req, res, sessionStore, monitorSecret),
  );

  return router;
}

module.exports = {
  createHealthRouter,
};
