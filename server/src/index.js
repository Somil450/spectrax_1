const { createServer } = require("./app/createServer");
const { logger } = require("./shared/utils/logger");
require("dotenv").config();

const runtime = createServer();

const shutdownHandler = () => {
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
};

process.on("SIGINT", shutdownHandler);
process.on("SIGTERM", shutdownHandler);

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
