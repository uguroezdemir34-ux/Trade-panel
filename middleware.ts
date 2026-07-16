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
 * KAPALI BETA KAPISI — Adım 4.1. Bu 4 sayfa, giriş yapmış olmak YETMEZ,
 * ayrıca publicMetadata.betaAccess===true VEYA plan pro/enterprise olmalı.
 *
 * ⚠️ ÇALIŞTIRILMADAN ÖNCE ZORUNLU Clerk Dashboard adımı: Clerk, varsayılan
 * olarak publicMetadata'yı session token'a (dolayısıyla sessionClaims'e)
 * DAHIL ETMEZ — Dashboard → Sessions → Customize session token'a şu claim'i
 * eklemeden bu middleware sessionClaims.publicMetadata'yı HER ZAMAN
 * `undefined` görür:
 *     { "publicMetadata": "{{user.public_metadata}}" }
 * Bu adım atlanırsa isBetaAllowed() aşağıda HER kullanıcı için (beta
 * üyeleri DAHİL) false döner — yani bu 4 sayfa HERKESTEN kapanır, sadece
 * yetkisizlerden değil. Deploy etmeden önce bu ayarı yapın.
 */
const isBetaGatedRoute = createRouteMatcher(["/karar(.*)", "/pnl(.*)", "/grafik(.*)", "/portfolyo(.*)"]);

interface BetaSessionClaims {
  publicMetadata?: { betaAccess?: boolean; plan?: string };
}

function isBetaAllowed(sessionClaims: BetaSessionClaims | undefined): boolean {
  const meta = sessionClaims?.publicMetadata;
  if (!meta) return false;
  if (meta.betaAccess === true) return true;
  return meta.plan === "pro" || meta.plan === "enterprise";
}

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

  // Kapalı beta kapısı — auth.protect() sadece "giriş yapmış mı" kontrol
  // eder; burada AYRICA "giriş yapmış AMA beta/pro değil" durumunu ele
  // alıyoruz.
  //
  // PROD KESİNTİSİ POST-MORTEM (bu yorum bilerek kalıcı — aynı hata
  // tekrarlanmasın diye): İlk sürüm burada "/" adresine yönlendiriyordu.
  // app/page.tsx ("/") KOŞULSUZ olarak redirect("/karar") yapıyor (önceden
  // var olan, bu dosyanın kapsamı dışındaki kod) — yani beta erişimi
  // olmayan bir kullanıcı /karar'a gelince buradan "/"e atılıyor, "/"
  // anında /karar'a geri atıyor: SONSUZ DÖNGÜ (→ prod'da "içerik yüklenmiyor/
  // beyaz ekran" olarak gözlemlendi). "/upgrade" bilerek seçildi: (a) kendi
  // içinde hiçbir redirect yok (app/upgrade/page.tsx sadece client-render
  // bir bileşen mount ediyor), (b) isBetaGatedRoute listesinde YOK, (c)
  // ürünsel olarak da daha doğru — "yetkin yok" yerine "yükselt" gösteriyor.
  if (isBetaGatedRoute(req)) {
    const { sessionClaims } = await auth();

    // [BETA-DEBUG] GEÇİCİ — betaAccess neden tanınmıyor sorununu teşhis
    // etmek için eklendi, kaynak teşhis edildikten sonra kaldırılacak.
    // Bu loglar TARAYICI KONSOLUNDA DEĞİL, Vercel Dashboard → proje →
    // Logs (Runtime/Function Logs, Edge ortamı) sekmesinde görünür —
    // Edge middleware sunucu tarafında çalışır, kullanıcının local
    // terminalinde değil.
    const debugMeta = (sessionClaims as BetaSessionClaims | undefined)?.publicMetadata;
    console.log("[BETA-DEBUG] path:", req.nextUrl.pathname);
    console.log("[BETA-DEBUG] sessionClaims (full):", JSON.stringify(sessionClaims, null, 2));
    console.log("[BETA-DEBUG] publicMetadata:", JSON.stringify(debugMeta, null, 2));
    console.log(
      "[BETA-DEBUG] betaAccess raw value:",
      debugMeta?.betaAccess,
      "| typeof:",
      typeof debugMeta?.betaAccess
    );
    console.log("[BETA-DEBUG] isBetaAllowed() result:", isBetaAllowed(sessionClaims as BetaSessionClaims | undefined));

    if (!isBetaAllowed(sessionClaims as BetaSessionClaims | undefined)) {
      return NextResponse.redirect(new URL("/upgrade", req.url));
    }
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
