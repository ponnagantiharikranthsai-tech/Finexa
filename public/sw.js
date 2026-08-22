// FINEXA Production-Safe Progressive Web App (PWA) Service Worker
const CACHE_NAME = "finexa-pwa-v1.0.5";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/logo.png",
  "/logo-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-192-maskable.png",
  "/icon-512-maskable.png",
  "/apple-touch-icon.png",
  "/badge.png",
];

// Install Event — Cache public static shell assets and skip waiting
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS).catch(function (err) {
        console.warn("PWA static asset caching notice:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event — Clean up obsolete caches and claim clients immediately
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log("[SW ACTIVATE] Deleting obsolete PWA cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Fetch Event — Safe network-first & fallback caching strategy (Zero ERR_FAILED)
self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);

  // 1. NEVER cache API requests, Next.js data routes, or non-GET requests (Network-Only)
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    request.method !== "GET"
  ) {
    return;
  }

  // 2. Cache-First strategy for static images, icons, and fonts
  if (
    request.destination === "image" ||
    request.destination === "font" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".svg")
  ) {
    event.respondWith(
      caches.match(request).then(function (cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then(function (networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Network-First strategy with Cache Fallback for Navigation (Guarantees clean HTTP redirects and zero ERR_FAILED)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function (networkResponse) {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(function () {
          // Offline Fallback — Try exact request, then /login, then /
          return caches.match(request).then(function (cachedResponse) {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match("/login").then(function (loginCache) {
              if (loginCache) {
                return loginCache;
              }
              return caches.match("/").then(function (rootCache) {
                return (
                  rootCache ||
                  new Response("FINEXA is currently offline.", {
                    status: 503,
                    headers: { "Content-Type": "text/plain" },
                  })
                );
              });
            });
          });
        })
    );
    return;
  }
});

// Native Android Web Push Notification Event (Official FINEXA Brand Avatar & Monochrome Badge)
self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "FINEXA — Payment Reminder";

    const options = {
      body: payload.body || "You have a new loan payment notification.",
      icon: payload.icon || "/icon-192.png",
      badge: payload.badge || "/badge.png",
      tag: payload.tag || `finexa-${Date.now()}`,
      renotify: true,
      data: {
        url: payload.url || "/notifications",
        loanId: payload.loanId || null,
      },
      actions: payload.actions || [
        { action: "review", title: "Review Application" },
        { action: "dismiss", title: "Dismiss" },
      ],
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Error processing Web Push payload in Service Worker:", err);
  }
});

// Notification Click Event — Navigates Android user to the target FINEXA page
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/notifications";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
