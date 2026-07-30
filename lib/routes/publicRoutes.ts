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
