/**
 * OTB Chess — Service Worker
 *
 * Strategy:
 *  - Static assets (JS, CSS, fonts, images): Cache-First with a version-keyed cache.
 *    On install, pre-cache the app shell. On activate, purge old caches.
 *  - API requests (/api/*): Network-First with a 4-second timeout, falling back to
 *    a cached response if the network is unavailable.
 *  - Navigation requests (HTML): Network-First, falling back to the cached index.html
 *    so the SPA still loads offline.
 */

const CACHE_VERSION = "otb-chess-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

// App shell — pre-cached on install
const APP_SHELL = ["/", "/index.html"];

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("otb-chess-") && k !== STATIC_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and browser-extension requests
  if (request.method !== "GET" || !url.protocol.startsWith("http")) return;

  // API requests: Network-First with timeout fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstWithTimeout(request, API_CACHE, 4000));
    return;
  }

  // Navigation requests (HTML): Network-First, fallback to cached index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match("/index.html").then(
            (cached) => cached || new Response("Offline — please reconnect.", { status: 503 })
          )
        )
    );
    return;
  }

  // Static assets: Cache-First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful same-origin or CDN responses
        if (response.ok && (url.origin === self.location.origin || url.hostname.includes("manuscdn.com"))) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) {
      const clone = response.clone();
      const cache = await caches.open(cacheName);
      cache.put(request, clone);
    }
    return response;
  } catch {
    clearTimeout(timer);
    const cached = await caches.match(request, { cacheName });
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
