/* NewDay Notebook — service worker.
 *
 * Purpose: make the app installable (Chrome's install path requires a service
 * worker with a fetch handler) and provide a basic offline fallback.
 *
 * Strategy: NETWORK-FIRST. Every request tries the network first, so a fresh
 * deploy is always picked up when online — this matches the repo's "always
 * latest" goal and avoids the classic PWA trap of users getting stuck on a
 * stale cached build. The cache is only a fallback for when the network is
 * unavailable. Same-origin GETs are cached as they load; the versioned CDN
 * files (React / Babel / fonts) are cache-first so the app can open offline
 * once it has been opened online. GitHub API calls are never touched.
 */
const CACHE = "newday-shell-v3";
const CDN_HOSTS = ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
];

// The library files the page loads from the CDN, fetched at install so the
// app can open offline even right after this worker is first installed.
const CDN_FILES = [
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all([
      cache.addAll(SHELL).catch(() => {}),
      ...CDN_FILES.map((u) => {
        const r = new Request(u, { mode: "no-cors" });
        return fetch(r).then((res) => cache.put(r, res)).catch(() => {});
      }),
    ]))
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
  const url = new URL(req.url);
  // Versioned library files (React, Babel) and fonts never change at a given
  // URL: serve them from the cache when present so the app opens offline.
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {});
          return res;
        }))
      )
    );
    return;
  }
  // Every other cross-origin request (the GitHub API for sync) goes straight
  // to the network, so an offline API call fails cleanly instead of being
  // answered with a cached page.
  if (url.origin !== self.location.origin) return;
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
