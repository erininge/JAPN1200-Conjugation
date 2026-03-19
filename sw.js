const CACHE_NAME = "japn1200-conjugation-v14";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./conjugationEngine.js",
  "./storage.js",
  "./manifest.json",
  "./data/verbs.json",
  "./data/adjectives.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve()));
    self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    const req = event.request;
    const cache = await caches.open(CACHE_NAME);

    // Network-first for page navigations so users on iPhone home screen
    // get new deployments without re-installing the shortcut.
    if (req.mode === "navigate") {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200) cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cachedPage = await cache.match(req);
        return cachedPage || cache.match("./index.html");
      }
    }

    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (req.method === "GET" && fresh && fresh.status === 200) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      return cached || cache.match("./index.html");
    }
  })());
});
