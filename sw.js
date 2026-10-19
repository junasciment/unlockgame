const CACHE_VERSION = "unlockgame-v7";
const PRECACHE = [
  "./",
  "index.html",
  "styles.css",
  "js/data.js",
  "js/core.js",
  "js/games.js",
  "js/app.js",
  "manifest.webmanifest",
  "assets/opt/puppybyte.png",
  "assets/opt/heart-pixel.png",
  "assets/opt/potion.png",
  "assets/opt/joycons.png",
  "assets/opt/handheld.png",
  "assets/opt/spiral.png",
  "assets/icons/icon-192.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.searchParams.has("__clock")) return;
  if (url.hostname.endsWith("spotify.com")) return;

  const isStatic = request.destination === "image" || request.destination === "font" || url.hostname.includes("fonts.g");
  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok || response.type === "opaque") {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("index.html")))
  );
});
