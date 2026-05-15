const { createServer } = require("./app/createServer");
const { logger } = require("./shared/utils/logger");
require("dotenv").config();

const runtime = createServer();

process.on("SIGINT", () => {
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
});

runtime.start().then(() => {
  logger.info(
    `\n🚀 SpectraX Backend running on http://localhost:${runtime.config.port}`,
  );
  logger.info(`   WebSocket: ws://localhost:${runtime.config.port}`);
  logger.info(`   Health:    http://localhost:${runtime.config.port}/health\n`);
});
