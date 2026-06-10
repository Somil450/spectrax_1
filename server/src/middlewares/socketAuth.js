const { SOCKET_AUTH_TOKEN } = require("../config/constants");

function createSocketAuthMiddleware() {
  return (socket, next) => {
    if (!SOCKET_AUTH_TOKEN) {
      return next();
    }
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (token !== SOCKET_AUTH_TOKEN) {
      return next(new Error("Authentication failed: invalid or missing token"));
    }
    next();
  };
}

module.exports = {
  createSocketAuthMiddleware,
};
