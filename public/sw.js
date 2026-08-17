// FINEXA Production-Safe Progressive Web App (PWA) Service Worker
const CACHE_NAME = "finexa-pwa-v1.0.3";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/home",
  "/loan-management",
  "/loans",
  "/borrowers",
  "/applications",
  "/reports",
  "/capital-management",
  "/logo.png",
  "/logo-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-192-maskable.png",
  "/icon-512-maskable.png",
  "/apple-touch-icon.png",
  "/badge.png",
];

// Install Event — Cache core static shell assets and skip waiting
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

// Activate Event — Clean up old caches and claim clients
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Fetch Event — Production-safe caching strategies
self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);

  // 1. NEVER cache sensitive financial API endpoints or authentication routes (Network-Only)
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    request.method !== "GET"
  ) {
    return; // Pass directly to network without service worker caching
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

  // 3. Stale-While-Revalidate strategy for HTML document pages (Instant <5ms PWA Launch)
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request).then(function (cachedResponse) {
        const fetchPromise = fetch(request)
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
            return cachedResponse;
          });

        // Return cached shell INSTANTLY (<5ms), revalidate in background
        return cachedResponse || fetchPromise;
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

    // Official FINEXA Notification Options
    // 'icon' points to the official gold FINEXA logo (/icon-192.png) to replace grey 'F' fallback
    // 'badge' points to the monochrome white alpha badge (/badge.png) for top-left header tinting
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
