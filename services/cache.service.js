const NodeCache = require("node-cache");

const cache = new NodeCache({
  stdTTL: 300,        // default TTL: 5 minutes
  checkperiod: 60,    // check for expired entries every 60 seconds
  useClones: false,   // improve performance by not cloning objects (be careful with mutations)
});

module.exports = { cache };
