import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { dbSelect, isDbConfigured } from "@/lib/db/server";
import { patchClerkPublicMetadata } from "@/lib/clerk/metadata";
import { isAdminUserId } from "@/lib/auth/admin";

const isPublicRoute = createRouteMatcher([
  "/",
  "/invite(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/stripe/webhook(.*)",
  "/api/cron(.*)",
  "/api/macro(.*)",
  "/api/global-ticker(.*)",
  "/api/waitlist/register(.*)",
  "/api/track-record(.*)",
  "/track-record(.*)",
  "/api/csp-report(.*)",
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

const isAdminApiRoute = createRouteMatcher(["/api/admin(.*)"]);
const isAdminPageRoute = createRouteMatcher(["/admin(.*)"]);

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

interface ClerkUserInfo {
  publicMetadata: RawPublicMetadata | null;
  email: string | null;
}

/**
 * Clerk'in REST API'sinden kullanıcının publicMetadata'sını VE birincil
 * email'ini DOĞRUDAN çeker — session token/JWT claim'lerine hiç bakmaz,
 * her zaman taze veri döner. Email, waitlist fallback kontrolü için lazım
 * (bkz. trySyncApprovedWaitlist) — ayrı bir Clerk çağrısı yerine aynı
 * response'tan okunuyor. CLERK_SECRET_KEY eksikse veya istek başarısızsa
 * ikisi de `null` döner (erişim YOK varsayılanına düşer — bkz. isBetaAllowed).
 */
async function fetchClerkUserInfo(userId: string): Promise<ClerkUserInfo> {
  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) return { publicMetadata: null, email: null };

  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${clerkKey}` },
    });
    if (!res.ok) return { publicMetadata: null, email: null };
    const data = (await res.json()) as {
      public_metadata?: RawPublicMetadata;
      email_addresses?: { id: string; email_address: string }[];
      primary_email_address_id?: string;
    };
    const primaryEmail =
      data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
        ?.email_address ?? data.email_addresses?.[0]?.email_address ?? null;
    return { publicMetadata: data.public_metadata ?? null, email: primaryEmail };
  } catch {
    return { publicMetadata: null, email: null };
  }
}

/**
 * WAITLIST FALLBACK — kullanıcı Clerk'te betaAccess almamış olabilir ama
 * admin onu waitlist'te hesap açmadan ÖNCE onaylamış olabilir (bkz.
 * lib/waitlist/approve.ts). Bu durumda burada tespit edilip Clerk
 * metadata'sı o an senkronize edilir (self-healing) — sonraki isteklerde
 * bu ekstra Supabase sorgusuna gerek kalmaz, isBetaAllowed() doğrudan
 * Clerk metadata üzerinden hızlı geçer. Sadece `!isBetaAllowed(...)`
 * durumunda çağrılır — zaten onaylı kullanıcılar için ekstra maliyeti yok.
 */
async function trySyncApprovedWaitlist(userId: string, email: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const rows = await dbSelect<{ status: string }>(
      "waitlist",
      `email=eq.${encodeURIComponent(email.toLowerCase())}&select=status`,
    );
    if (rows.length === 0 || rows[0].status !== "approved") return false;
    await patchClerkPublicMetadata(userId, { betaAccess: true });
    return true;
  } catch {
    return false;
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
 * ENFORCE MOD — 30 Temmuz'da Report-Only olarak devreye alındı, 2+ gün
 * canlı trafikte izlendi: app/api/csp-report/route.ts hem console.error
 * hem Sentry.captureMessage'a yazıyordu, Sentry'de tek bir "CSP
 * Report-Only ihlali" issue'su bile açılmadı — Clerk/Stripe/font/WS
 * domain listesi (statik kod taramasıyla çıkarılmıştı, bkz. ANALYSIS.md)
 * gerçek trafikte doğrulandı. Bu yeterli sinyal kabul edilip (kullanıcı
 * onayıyla) `Content-Security-Policy-Report-Only`'den gerçek
 * `Content-Security-Policy`'ye geçildi — tarayıcı artık ihlalleri
 * gerçekten bloklar.
 *
 * report-uri + report-to BİLEREK KALDI (enforce'a geçtikten sonra da):
 * yeni bir tarayıcı/cihaz/ortam kombinasyonunda beklenmedik bir blok
 * olursa (report-only döneminde görülmeyen bir edge case), bunu yine
 * Sentry'de görebilmek için — enforce modunda da bir CSP header
 * report-uri/report-to taşıyabilir, ikisi birbirini dışlamaz. İkisi
 * birden verilir çünkü tarayıcı desteği bölünmüş: report-uri eski ama
 * Firefox/Safari'nin hâlâ tek desteklediği yol, report-to (+ aşağıdaki
 * Reporting-Endpoints header'ı) modern Reporting API'yi destekleyen
 * tarayıcılar (Chrome) için.
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
    `report-uri /api/csp-report`,
    `report-to csp-endpoint`,
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
  // app/page.tsx ("/") o zaman KOŞULSUZ olarak redirect("/karar") yapıyordu
  // — yani beta erişimi olmayan bir kullanıcı /karar'a gelince buradan
  // "/"e atılıyor, "/" anında /karar'a geri atıyor: SONSUZ DÖNGÜ (→ prod'da
  // "içerik yüklenmiyor/beyaz ekran" olarak gözlemlendi). GÜNCEL DURUM
  // (WaitlistScreen eklendikten sonra): app/page.tsx artık "/"i KOŞULSUZ
  // redirect etmiyor — sadece Clerk session'ı OLAN kullanıcıyı /karar'a
  // yönlendiriyor, session'ı olmayana WaitlistScreen render ediyor. Yani
  // döngü riski hâlâ GEÇERLİ ama daralmış: eğer bu blok "/" adresine
  // yönlendirseydi, sadece giriş yapmış-ama-beta-olmayan kullanıcılar için
  // aynı döngü tekrar oluşurdu (session'ı olduğu için "/" onu yine
  // /karar'a atar). "/upgrade" bilerek seçildi: (a) kendi
  // içinde hiçbir redirect yok (app/upgrade/page.tsx sadece client-render
  // bir bileşen mount ediyor), (b) isBetaGatedRoute listesinde YOK, (c)
  // ürünsel olarak da daha doğru — "yetkin yok" yerine "yükselt" gösteriyor.
  if (isBetaGatedRoute(req)) {
    const { userId } = await auth();
    const info = userId ? await fetchClerkUserInfo(userId) : { publicMetadata: null, email: null };

    let allowed = isBetaAllowed(info.publicMetadata);
    if (!allowed && userId && info.email) {
      allowed = await trySyncApprovedWaitlist(userId, info.email);
    }

    if (!allowed) {
      return NextResponse.redirect(new URL("/upgrade", req.url));
    }
  }

  // ADMIN KAPISI — /admin (sayfa) ve /api/admin (API) sadece
  // ADMIN_USER_IDS env var'ındaki Clerk userId'lerine açık (bkz.
  // lib/auth/admin.ts). API route'ları zaten kendi 403'ünü kendi de
  // döner — bu, Edge seviyesinde erken-reddetme (route handler'a hiç
  // girmeden), ikinci bir savunma katmanı.
  if (isAdminApiRoute(req) || isAdminPageRoute(req)) {
    const { userId } = await auth();
    if (!isAdminUserId(userId)) {
      if (isAdminApiRoute(req)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/karar", req.url));
    }
  }

  const nonce = generateNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // buildCsp()'nin report-to direktifinin çözümlediği endpoint adı —
  // Reporting API (Chrome) bu header olmadan report-to'yu yok sayar.
  response.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/csp-report"');
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)",
    "/(api|trpc)(.*)",
  ],
};
