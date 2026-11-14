self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// The app is deliberately network-first: realtime rooms and API data must
// never be served from a stale cache. This handler makes the app installable.
self.addEventListener("fetch", () => {});
