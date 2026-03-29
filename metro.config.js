// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// 1. Create a unique cache version based on the APP_ENV
const currentEnv = process.env.APP_ENV || 'dev';
config.cacheVersion = `nn-v2-${currentEnv}`;

// 2. FORCE Metro to use a distinct physical directory for the cache
// This prevents parallel processes from deadlocking or poisoning each other.
config.cacheStores = [
  new (require('metro-cache')).FileStore({
    root: path.join(__dirname, 'node_modules', '.cache', 'metro', currentEnv),
  }),
];

module.exports = config;