const STATIC_CACHE = "alexfrut-static-v3";
const PRECACHE_ASSETS = [
  "/splash/alexfrut-intro.mp4",
  "/brand/alexfrut-logo-icon.png",
  "/brand/alexfrut-logo-square.png",
  "/apple-touch-icon.png",
];

async function precacheStaticAssets() {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(PRECACHE_ASSETS);
}

async function createPartialResponse(request, cachedResponse) {
  const range = request.headers.get("range");
  const contentType = cachedResponse.headers.get("content-type") || "video/mp4";

  if (!range) {
    return cachedResponse;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);

  if (!match) {
    return cachedResponse;
  }

  const blob = await cachedResponse.blob();
  const size = blob.size;
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;

  if (!match[1] && match[2]) {
    const suffixLength = Number(match[2]);
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`,
      },
    });
  }

  end = Math.min(end, size - 1);
  const body = blob.slice(start, end + 1, contentType);

  return new Response(body, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Type": contentType,
    },
  });
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
        return createPartialResponse(request, cachedResponse);
      }

      const response = await fetch(request);

      if (response.ok && !request.headers.has("range")) {
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
