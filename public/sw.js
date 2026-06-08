/* QUANTIX OS — Service Worker v2
 * Premium mobil deneyim için:
 *   1. Zengin push bildirimleri (şifreli payload desteği)
 *   2. Aksiyon butonları (Aç / Kapat)
 *   3. Background sync yeniden deneme
 *   4. Gelişmiş offline cache stratejisi
 */

const CACHE = "quantix-v2";
const OFFLINE_PAGE = "/offline";
const PRECACHE = ["/", "/manifest.json"];

// ── Install: app shell önbelleğe al ──────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
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

// ── Fetch: stale-while-revalidate (statik) + network-first (API) ─
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // API + WS → network only
  if (url.pathname.startsWith("/api/") || url.protocol === "wss:") return;

  // Next.js static: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            if (res.ok && res.type !== "opaque") {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(request, clone));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Sayfalar: network-first, offline fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(request)
          .then((cached) => cached ?? caches.match(OFFLINE_PAGE)),
      ),
  );
});

// ── Push: zengin bildirim göster ─────────────────────────────
self.addEventListener("push", (event) => {
  let title = "🚀 QUANTIX OS";
  let body = "Yeni sinyal — uygulamayı açın";
  let url = "/karar";
  let pair = "";
  let kind = "go_signal";
  let direction = "";

  if (event.data) {
    try {
      const d = event.data.json();
      if (d.title) title = d.title;
      if (d.body) body = d.body;
      if (d.url) url = d.url;
      if (d.pair) pair = d.pair;
      if (d.kind) kind = d.kind;
      if (d.direction) direction = d.direction;
    } catch {
      const text = event.data.text();
      if (text) body = text;
    }
  }

  // Kind'a göre aksiyon butonları
  const actions = buildActions(kind, pair);
  const tag = `quantix-${kind}-${pair || Date.now()}`;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag,
      renotify: kind === "go_signal" || kind === "price_alarm",
      requireInteraction: kind === "sl_hit" || kind === "consecutive_loss",
      silent: false,
      vibrate:
        kind === "sl_hit"
          ? [200, 100, 200, 100, 200]
          : kind === "go_signal"
          ? [100, 50, 100]
          : [100],
      data: { url, pair, kind, direction },
      actions,
    }),
  );
});

function buildActions(kind, pair) {
  if (kind === "go_signal") {
    return [
      { action: "open_karar", title: "📊 Sinyal" },
      { action: "open_pozisyon", title: "📈 Pozisyon" },
    ];
  }
  if (kind === "price_alarm" || kind === "sl_hit") {
    return [
      { action: "open_karar", title: "📊 Karar" },
      { action: "dismiss", title: "Kapat" },
    ];
  }
  return [{ action: "open", title: "Aç" }];
}

// ── Notification click: uygulamayı aç veya odakla ────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data ?? {};
  let targetUrl = data.url ?? "/";

  // Aksiyon butonuna göre yönlendir
  if (event.action === "open_karar") targetUrl = "/karar";
  else if (event.action === "open_pozisyon") targetUrl = "/pozisyon";
  else if (event.action === "dismiss") return;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Açık pencere varsa odakla + navigate
        for (const client of windowClients) {
          if ("focus" in client) {
            void client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Yoksa yeni pencere aç
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});

// ── Background sync: offline sıradaki işlemleri retry et ─────
self.addEventListener("sync", (event) => {
  if (event.tag === "quantix-sync") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) =>
          c.postMessage({ type: "BACKGROUND_SYNC" }),
        );
      }),
    );
  }
});

// ── Mesaj: ana thread'den komutlar ───────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "CACHE_BUST") {
    caches.delete(CACHE);
  }
});
