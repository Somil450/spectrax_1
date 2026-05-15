const path = require("path");

const SERVER_ROOT = path.resolve(__dirname, "..", "..");

function resolveSessionPath(fileName = "session.json") {
  return path.join(SERVER_ROOT, fileName);
}

module.exports = {
  SERVER_ROOT,
  resolveSessionPath,
};
