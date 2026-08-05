/**
 * PUBLIC ROUTES — AppShell route-gating için paylaşılan sabit.
 *
 * middleware.ts'teki isPublicRoute'un regex pattern'leriyle KARIŞTIRILMASIN —
 * o auth (Clerk session gerekip gerekmediği) için, bu ise RouteAwareShell.tsx
 * üzerinden AppShell'in (canlı trading verisi/hook'ları) mount edilip
 * edilmeyeceği için — ayrı bir amaç, ayrı bir liste. Route'un başlangıcı
 * eşleşmesi yeterli (prefix match) — ör. "/invite" → "/invite/abc123" de
 * eşleşir ("/sign-in" → "/sign-in/sso-callback" gibi Clerk'in çok adımlı
 * akış alt-path'leri için de aynı mantık geçerli).
 */
export const PUBLIC_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/privacy",
  "/terms",
  "/track-record",
  "/",
  "/invite",
] as const;

/** pathname bir public route'un kendisi veya alt-path'i mi? */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * APP ROUTES — AppShell (canlı trading hook'ları: WS bağlantıları, skor
 * motoru, 20+ poller/alert) gerektiren bilinen sayfa route'ları.
 *
 * PUBLIC_ROUTES'tan AYRI bir liste: PUBLIC_ROUTES "AppShell'e hiç gerek
 * yok" demek, bu liste ise "AppShell'e GERÇEKTEN gerek var" demek. İkisinin
 * dışında kalan her pathname (ör. yanlış yazılmış bir URL) gerçek bir
 * 404'tür — RouteAwareShell.tsx bu durumda da AppShell'i mount etmemeli
 * (bkz. isAppRoute kullanımı orada).
 *
 * "/admin" kendisi sayfa değil (alt route'ları var: /admin/waitlist,
 * /admin/genel-bakis) — prefix eşleşmesiyle zaten kapsanıyor.
 */
export const APP_ROUTES = [
  "/admin",
  "/analiz",
  "/ayarlar",
  "/backtest",
  "/grafik",
  "/haberler",
  "/karar",
  "/piyasa",
  "/pnl",
  "/portfolyo",
  "/pozisyon",
  "/risk",
  "/upgrade",
] as const;

/** pathname AppShell gerektiren bilinen bir route'un kendisi veya alt-path'i mi? */
export function isAppRoute(pathname: string): boolean {
  return APP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
