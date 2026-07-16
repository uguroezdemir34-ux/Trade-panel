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
 * ayrıca publicMetadata.betaAccess===true (veya "true"/1/"1") VEYA plan
 * pro/enterprise olmalı.
 *
 * ÖNCEKİ SÜRÜM sessionClaims.publicMetadata (JWT claim) okuyordu — bu,
 * Clerk Dashboard'da ayrı bir "Customize session token" adımı gerektiriyordu
 * ve üretimde /api/debug/beta-claims ile doğrulandı: bu adım hiç etkili
 * olmuyordu (sessionClaims.publicMetadata sürekli `null`). Üstelik
 * session-claims'ten TAMAMEN bağımsız olan currentUser().publicMetadata de
 * aynı anda boş çıktı — yani mesele sadece JWT claim eksikliği değildi, veri
 * o an gerçekten hiç set edilmemişti. Bu sürüm artık session claim'lere hiç
 * bağımlı değil — userId'yi auth()'tan alıp Clerk'in REST API'sinden
 * publicMetadata'yı DOĞRUDAN, her istekte taze çekiyor.
 *
 * TRADE-OFF: bu, her beta-gated route isteğinde (navigasyon başına, Next.js
 * prefetch'leri dahil) bir Clerk API round-trip'i ekliyor — session-claims
 * yaklaşımının sıfır-ekstra-istek avantajı kayboluyor. Kapalı beta'nın
 * düşük trafik hacminde kabul edilebilir; ölçek büyürse ayrı bir
 * cache/session-claims turu gerekebilir.
 */
const isBetaGatedRoute = createRouteMatcher(["/karar(.*)", "/pnl(.*)", "/grafik(.*)", "/portfolyo(.*)"]);

interface RawPublicMetadata {
  betaAccess?: unknown;
  plan?: unknown;
}

/**
 * Clerk publicMetadata'da betaAccess bazı durumlarda boolean `true` yerine
 * string `"true"`/`"1"` olarak saklanmış olabilir (Dashboard'dan elle JSON
 * girişi ya da API/serileştirme farkı) — tip toleranslı okunuyor.
 */
function isTruthyFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function isBetaAllowed(meta: RawPublicMetadata | null): boolean {
  if (!meta) return false;
  if (isTruthyFlag(meta.betaAccess)) return true;
  const plan = typeof meta.plan === "string" ? meta.plan.toLowerCase() : undefined;
  return plan === "pro" || plan === "enterprise";
}

/**
 * Clerk'in REST API'sinden kullanıcının publicMetadata'sını DOĞRUDAN çeker
 * — session token/JWT claim'lerine hiç bakmaz, her zaman taze veri döner.
 * CLERK_SECRET_KEY eksikse veya istek başarısızsa `null` döner (erişim YOK
 * varsayılanına düşer — bkz. isBetaAllowed).
 */
async function fetchPublicMetadata(userId: string): Promise<RawPublicMetadata | null> {
  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) return null;

  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${clerkKey}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { public_metadata?: RawPublicMetadata };
    return data.public_metadata ?? null;
  } catch {
    return null;
  }
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
    const { userId } = await auth();
    const meta = userId ? await fetchPublicMetadata(userId) : null;

    // [BETA-DEBUG] GEÇİCİ — session-claims'ten canlı Clerk API fetch'ine
    // geçildikten sonra hâlâ sorun sürerse teşhis için. Vercel Dashboard →
    // proje → Logs (Runtime/Function Logs, Edge ortamı) sekmesinde görünür.
    console.log("[BETA-DEBUG] path:", req.nextUrl.pathname, "| userId:", userId);
    console.log("[BETA-DEBUG] live publicMetadata (Clerk REST API):", JSON.stringify(meta, null, 2));
    console.log("[BETA-DEBUG] isBetaAllowed() result:", isBetaAllowed(meta));

    if (!isBetaAllowed(meta)) {
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
