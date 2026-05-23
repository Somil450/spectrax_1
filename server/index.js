/**
 * SpectraX Real-Time Backend - Entry Point
 * Express + Socket.IO — ultra-low latency pose processing
 * 
 * This is the main entry point that starts the Express app
 * The app configuration is in src/app.js
 */

const { server, PORT } = require("./src/app");

// ─── Start Server ──────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 SpectraX Backend running on http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Health:    http://localhost:${PORT}/health\n`);
});
