// FINEXA Service Worker for Real Web Push Notifications
self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "FINEXA — Payment Reminder";
    const options = {
      body: payload.body || "You have a new loan payment notification.",
      icon: payload.icon || "/logo-icon.png",
      badge: payload.badge || "/logo-icon.png",
      tag: payload.tag || `finexa-${Date.now()}`,
      renotify: true,
      data: {
        url: payload.url || "/notifications",
        loanId: payload.loanId || null,
      },
      actions: [
        { action: "open_loan", title: "View Details" },
        { action: "dismiss", title: "Dismiss" },
      ],
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Error processing Web Push payload in Service Worker:", err);
  }
});

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
