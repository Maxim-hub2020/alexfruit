const STATIC_CACHE = "alexfrut-static-v4";
const PRECACHE_ASSETS = [
  "/brand/alexfrut-logo-icon.png",
  "/brand/alexfrut-logo-square.png",
  "/apple-touch-icon.png",
];

async function precacheStaticAssets() {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(PRECACHE_ASSETS);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheStaticAssets()
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("alexfrut-static-"))
            .filter((cacheName) => cacheName !== STATIC_CACHE)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (
    url.origin !== self.location.origin ||
    !PRECACHE_ASSETS.includes(url.pathname)
  ) {
    return;
  }

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cachedResponse = await cache.match(url.pathname);

      if (cachedResponse) {
        return cachedResponse;
      }

      const response = await fetch(request);

      if (response.ok) {
        cache.put(url.pathname, response.clone()).catch(() => undefined);
      }

      return response;
    }),
  );
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
