self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "АлексФрут";
  const message = payload.message || "Новое уведомление по заказу";
  const url = payload.url || "/orders";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: message,
      icon: "/brand/alexfrut-logo-icon.png",
      badge: "/brand/alexfrut-logo-icon.png",
      tag: payload.id || `alexfrut-${Date.now()}`,
      renotify: true,
      requireInteraction: payload.type === "REPLACEMENT_REQUIRED",
      data: {
        url,
        notificationId: payload.id || null,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || "/orders",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        const existingClient = clientList.find((client) =>
          client.url.startsWith(self.location.origin),
        );

        if (existingClient) {
          if ("navigate" in existingClient) {
            existingClient.navigate(targetUrl);
          }

          return existingClient.focus();
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
