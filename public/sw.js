// Self-unregistering stub service worker.
// A previous version of this app registered a service worker. Browsers that
// cached that registration keep requesting /sw.js. This stub takes over,
// clears all caches, and unregisters itself so those clients heal on first
// reload and this file can eventually be deleted.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (_) {
        // ignore
      }
      try {
        await self.registration.unregister();
      } catch (_) {
        // ignore
      }
      const clientsList = await self.clients.matchAll({ type: "window" });
      for (const client of clientsList) {
        client.navigate(client.url);
      }
    })()
  );
});
