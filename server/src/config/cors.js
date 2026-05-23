function createCorsOptions(config) {
  return {
    origin: config.corsOrigin,
  };
}

module.exports = {
  createCorsOptions,
};
