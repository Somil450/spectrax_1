const { createServer } = require("./app/createServer");
const { logger } = require("./shared/utils/logger");

const runtime = createServer();

let shuttingDown = false;

// Handles both SIGINT (interactive, e.g. Ctrl+C) and SIGTERM (orchestrated, e.g.
// Docker/Kubernetes/PM2/systemd) so the server saves sessions and exits cleanly
// on any stop or restart. The shuttingDown guard makes a repeated signal safe.
function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info("\n[SpectraX] Shutting down — saving all sessions...");
  runtime
    .shutdown()
    .then(() => {
      logger.info("[SpectraX] Server closed.");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("[SpectraX] Shutdown failed:", error.message);
      process.exit(1);
    });
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

runtime
  .start()
  .then(() => {
    logger.info(
      `\n🚀 SpectraX Backend running on http://localhost:${runtime.config.port}`,
    );
    logger.info(`   WebSocket: ws://localhost:${runtime.config.port}`);
    logger.info(
      `   Health:    http://localhost:${runtime.config.port}/health\n`,
    );
  })
  .catch((error) => {
    logger.error("[SpectraX] Failed to start server:", error.message);
    process.exit(1);
  });
