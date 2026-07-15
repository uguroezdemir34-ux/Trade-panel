import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/privacy(.*)",
  "/terms(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/stripe/webhook(.*)",
  "/api/cron(.*)",
  "/api/macro(.*)",
  "/api/okx/api/v5/market/(.*)",
  "/api/okx/api/v5/public/(.*)",
]);

/**
 * CSP NONCE — her istekte rastgele, tek kullanımlık bir değer. layout.tsx'teki
 * iki inline <script>'e (theme FOUC + dev-debug overlay) bu nonce enjekte
 * edilir, CSP de sadece BU nonce'a sahip inline script'lere izin verir.
 * `next/headers`'ın `headers()` fonksiyonu REQUEST header'larını okur — bu
 * yüzden nonce, middleware'de response header'ı olarak DEĞİL, `request.headers`
 * üzerinden downstream'e (Server Component'lere) taşınıyor (bkz. NextResponse.next
 * altındaki request.headers override — Next.js'in resmi CSP-nonce deseni).
 */
function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * REPORT-ONLY MOD — bilerek `Content-Security-Policy` değil,
 * `Content-Security-Policy-Report-Only` header'ı kullanılıyor: tarayıcı
 * ihlalleri konsola loglar ama HİÇBİR ŞEYİ bloklamaz. Clerk/Stripe/font/WS
 * domain listesi statik kod taramasıyla çıkarıldı (bkz. ANALYSIS.md) ama
 * çalışma zamanında görülmeyen bir domain kaçmış olabilir — enforce moduna
 * (`Content-Security-Policy`) geçiş, gerçek trafikte ihlal loglanmadığı
 * doğrulandıktan SONRA, ayrı bir onaylı adımda yapılmalı.
 */
function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https://s2.coinmarketcap.com https://cdn.jsdelivr.net`,
    `connect-src 'self' https://api.clerk.com https://*.clerk.accounts.dev wss://ws.okx.com wss://wsaws.okx.com wss://wsap.okx.com wss://stream.binance.com wss://fstream.binance.com wss://fstream1.binance.com wss://stream.bybit.com wss://stream.bytick.com`,
    `frame-src 'self' https://*.clerk.accounts.dev`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join("; ");
}

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  const nonce = generateNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy-Report-Only", buildCsp(nonce));
  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)",
    "/(api|trpc)(.*)",
  ],
};
