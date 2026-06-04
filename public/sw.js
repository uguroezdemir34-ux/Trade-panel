/* QUANTIX OS — Service Worker
 * Görevler:
 *   1. Push events → bildirim göster
 *   2. Minimal offline cache (app shell)
 *   3. Notification click → uygulamayı aç/odakla
 */

const CACHE = "quantix-v1";

// ── Install: app shell önbelleğe al ──────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(["/", "/manifest.json"]))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: eski cache'leri sil ────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: statik varlıklar için cache-first ─────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // API çağrılarını cache'leme
  if (request.url.includes("/api/")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        // Sadece başarılı, opaque olmayan yanıtları cache'le
        if (res.ok && res.type !== "opaque") {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      });
    }),
  );
});

// ── Push: GO sinyal bildirimi ─────────────────────────────────
self.addEventListener("push", (event) => {
  let title = "🚀 QUANTIX OS";
  let body = "GO sinyali tespit edildi — detaylar için uygulamayı açın";
  let pair = "";

  if (event.data) {
    try {
      const d = event.data.json();
      if (d.title) title = d.title;
      if (d.body) body = d.body;
      if (d.pair) pair = d.pair;
    } catch {
      // data text olabilir
      const text = event.data.text();
      if (text) body = text;
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: pair ? `quantix-go-${pair}` : "quantix-go",
      renotify: true,
      requireInteraction: false,
      data: { url: "/" },
    }),
  );
});

// ── Notification click: uygulamayı aç veya odakla ────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});
