/*
 * Forge30 service worker (hand-rolled).
 *
 * Strategy:
 *  - Precache the app shell routes + offline fallback on install.
 *  - Navigations: network-first, falling back to the cached shell so the
 *    installed PWA opens instantly and works offline (all user data lives in
 *    localStorage, which is offline-native).
 *  - Static assets (/_next/static, icons, fonts): cache-first — they are
 *    content-hashed and immutable.
 */

const VERSION = "forge30-v20";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;

const SHELL_ROUTES = [
  "/",
  "/today",
  "/nutrition",
  "/training",
  "/mind",
  "/money",
  "/progress",
  "/coach",
  "/skills",
  "/health",
  "/assessments",
  "/relationships",
  "/social",
  "/settings",
  "/manifest.json",
  "/protocols",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ROUTES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first with cached shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached =
            (await caches.match(request)) ||
            (await caches.match(url.pathname)) ||
            (await caches.match("/today"));
          return (
            cached ||
            new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          );
        })
    );
    return;
  }

  // Immutable static assets: cache-first.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json";
  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});

// --- Notifications (E9) -----------------------------------------------------
// Web Push payloads (once the push backend exists) and clicks on any
// notification shown via registration.showNotification (the in-app scheduler
// uses that path today).

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Non-JSON payload — show the default shell notification.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Forge30", {
      body: data.body || "",
      tag: data.tag || "forge30",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/today" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/today";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
