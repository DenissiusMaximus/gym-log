// package.json has no "type": "module", so this CommonJS file is loaded as is.
module.exports = {
  globDirectory: 'dist',
  globPatterns: ['**/*.{js,css,html,ttf,woff2,png,ico,svg,json,webmanifest}'],
  // Expo puts font files under a `node_modules`-derived path; the default ignore would drop them.
  globIgnores: ['sw.js'],
  swDest: 'dist/sw.js',
  navigateFallback: '/index.html',
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  // A new worker waits; the app shows "New version available" and sends SKIP_WAITING.
  skipWaiting: false,
  // Without this a bundle over 2 MB silently misses the precache and offline breaks.
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
};
