function createSocketRateLimitMiddleware({ ipConnectionCount, maxConnectionsPerIp }) {
  return (socket, next) => {
    const ip = socket.handshake.address;
    const count = (ipConnectionCount.get(ip) || 0) + 1;
    if (count > maxConnectionsPerIp) {
      return next(new Error(`Connection limit exceeded for ${ip}`));
    }
    ipConnectionCount.set(ip, count);
    next();
  };
}

module.exports = {
  createSocketRateLimitMiddleware,
};
