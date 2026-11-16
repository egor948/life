/* Life PWA — офлайн-кэш и уведомления. Работает в подпапке GitHub Pages. */
const VERSION = "life-v1.2.0";
const SCOPE = self.registration.scope;
const URLS = {
  base: new URL("./", SCOPE).href,
  index: new URL("index.html", SCOPE).href,
  manifest: new URL("manifest.json", SCOPE).href,
  icon: new URL("icons/icon-192.png", SCOPE).href,
  iconBig: new URL("icons/icon-512.png", SCOPE).href,
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.allSettled(
        [URLS.base, URLS.index, URLS.manifest, URLS.icon, URLS.iconBig].map((url) => cache.add(url)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("life-") && key !== VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Навигация: сеть → свежий кэш → офлайн-оболочка.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            const cache = await caches.open(VERSION);
            cache.put(URLS.index, response.clone());
          }
          return response;
        } catch {
          const cache = await caches.open(VERSION);
          return (
            (await cache.match(request)) ||
            (await cache.match(URLS.index)) ||
            (await cache.match(URLS.base)) ||
            new Response("<h1>Life</h1><p>Нет соединения. Откройте приложение офлайн ещё раз.</p>", {
              headers: { "Content-Type": "text/html; charset=utf-8" },
              status: 200,
            })
          );
        }
      })(),
    );
    return;
  }

  // Статика: кэш → сеть, с обновлением кэша.
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok && response.type === "basic") cache.put(request, response.clone());
        return response;
      } catch {
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })(),
  );
});

/* Совместимость с push: если когда-нибудь появится сервер push. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Life", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Life", {
      body: data.body || "",
      tag: data.tag,
      icon: URLS.icon,
      badge: URLS.icon,
      data: data.data || {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        if ("focus" in client) {
          client.postMessage({ type: "open", refType: data.refType, refId: data.refId });
          return client.focus();
        }
      }
      const query =
        data.refType && data.refId
          ? `?open=${encodeURIComponent(data.refType + ":" + data.refId)}`
          : "";
      return self.clients.openWindow(URLS.base + query);
    })(),
  );
});
