// Quick test script to verify module imports
const path = require("path");
process.chdir(path.join(__dirname, "server"));

try {
  console.log("Testing imports...\n");

  // Test config imports
  console.log("✓ Testing config/constants...");
  const { PORT, SESSIONS_DIR } = require("./src/config/constants");
  console.log(`  PORT: ${PORT}, SESSIONS_DIR: ${SESSIONS_DIR}`);

  console.log("✓ Testing config/cors...");
  const { corsOptions, isOriginAllowed } = require("./src/config/cors");
  console.log("  CORS configured");

  // Test module imports
  console.log("✓ Testing modules/angleUtils...");
  const { computeAngles } = require("./src/modules/angleUtils");
  console.log("  Angle utils loaded");

  console.log("✓ Testing modules/feedbackEngine...");
  const { generateFeedback } = require("./src/modules/feedbackEngine");
  console.log("  Feedback engine loaded");

  console.log("✓ Testing modules/poseProcessor...");
  const { processPose } = require("./src/modules/poseProcessor");
  console.log("  Pose processor loaded");

  console.log("✓ Testing modules/sessionStorage...");
  const { saveSession } = require("./src/modules/sessionStorage");
  console.log("  Session storage loaded");

  // Test middleware
  console.log("✓ Testing middleware/errorHandler...");
  const errorHandler = require("./src/middleware/errorHandler");
  console.log("  Error handler loaded");

  // Test socket handlers
  console.log("✓ Testing socket/handlers...");
  const setupSocketHandlers = require("./src/socket/handlers");
  console.log("  Socket handlers loaded");

  // Test routes
  console.log("✓ Testing modules/healthRoute...");
  const setupHealthRoute = require("./src/modules/healthRoute");
  console.log("  Health route loaded");

  console.log("\n✅ All imports successful! Backend structure is valid.\n");
} catch (err) {
  console.error("❌ Import error:", err.message);
  console.error(err.stack);
  process.exit(1);
}
