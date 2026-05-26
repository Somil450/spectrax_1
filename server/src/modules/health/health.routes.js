const express = require("express");
const { getHealth } = require("./health.controller");

function createHealthRouter({ sessionStore }) {
  const router = express.Router();

  router.get("/health", (req, res) => getHealth(req, res, sessionStore));

  return router;
}

module.exports = {
  createHealthRouter,
};
