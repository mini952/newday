/* NewDay Notebook — service worker.
 *
 * Purpose: make the app installable (Chrome's install path requires a service
 * worker with a fetch handler) and provide a basic offline fallback.
 *
 * Strategy: NETWORK-FIRST. Every request tries the network first, so a fresh
 * deploy is always picked up when online — this matches the repo's "always
 * latest" goal and avoids the classic PWA trap of users getting stuck on a
 * stale cached build. The cache is only a fallback for when the network is
 * unavailable. Only same-origin GETs are cached; the cross-origin CDN scripts
 * (React / Babel) are always fetched live, so a cold offline start still needs
 * a connection to load those libraries. Full offline would require caching the
 * CDN assets too — deliberately left out for now.
 */
const CACHE = "newday-shell-v2";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Only this site's own files. Cross-origin requests (React/Babel CDN, the
  // GitHub API for sync) go straight to the network, so an offline API call
  // fails cleanly instead of being answered with a cached page.
  if (new URL(req.url).origin !== self.location.origin) return;
  // Pages are always revalidated with the server (cache: "no-cache"), so a
  // reload never gets a stale copy from the browser's HTTP cache. A
  // navigation Request can't be cloned with options, so rebuild it by URL.
  const isPage = req.mode === "navigate";
  const netReq = isPage ? new Request(req.url, { cache: "no-cache", credentials: "same-origin" }) : req;
  event.respondWith(
    fetch(netReq)
      .then((res) => {
        // Cache successful same-origin responses for offline fallback.
        // Skip URLs with a query (update checks, ?v= reloads) so the cache
        // doesn't fill up with one-off copies.
        if (res && res.ok && !new URL(req.url).search) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match("./index.html"))
      )
  );
});
