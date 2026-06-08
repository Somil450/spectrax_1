const express = require('express');
const socketIo = require('socket.io');

function createServer(overrides = {}) {
  const ipConnectionCount = new Map();
  
  const app = express();
  const config = {
    maxConnectionsPerIp: 10,
    ...overrides,
  };

  const io = socketIo(app);

  io.use((socket, next) => {
    const ip = socket.handshake.address;
    const count = (ipConnectionCount.get(ip) || 0) + 1;

    if (count > config.maxConnectionsPerIp) {
      return next(new Error('Connection limit exceeded'));
    }

    ipConnectionCount.set(ip, count);
    
    socket.on('disconnect', () => {
      const currentCount = ipConnectionCount.get(ip) || 0;
      if (currentCount > 1) {
        ipConnectionCount.set(ip, currentCount - 1);
      } else {
        ipConnectionCount.delete(ip);
      }
    });

    next();
  });

  return {
    app,
    io,
    listen: (port, callback) => app.listen(port, callback),
  };
}

module.exports = {
  createServer,
};
