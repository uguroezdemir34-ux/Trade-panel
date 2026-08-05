"use client";

/**
 * ROUTE AWARE SHELL — AppShell'i (WS bağlantıları, skor motoru, 20+ poller/
 * alert hook'u) sadece auth-sonrası/trading route'larında mount eder.
 *
 * Perf teşhisinde bulundu: AppShell önceden TÜM route'larda (login dahil)
 * koşulsuz mount ediliyordu — /sign-in gibi auth-öncesi sayfalarda LCP'yi
 * 10+ saniyeye çıkaran ana neden buydu.
 *
 * PUBLIC_ROUTES'taki bir route'a denk geliyorsa: çıplak {children} +
 * (SADECE /track-record'da) DisclaimerModal render edilir — App Store
 * 4.2.2 risk uyarısı, /track-record genel-halka-açık VE trading içerikli
 * olduğu için kullanıcı kararıyla burada tutuldu; diğer public route'larda
 * (sign-in/sign-up/privacy/terms/"/"/invite) hiç gösterilmiyor.
 *
 * Ne PUBLIC_ROUTES ne APP_ROUTES'a denk geliyorsa (gerçek 404, bkz.
 * lib/routes/publicRoutes.ts'teki isAppRoute): AppShell yine mount
 * edilmez, çıplak {children} (yani NotFound sayfası) render edilir —
 * eskiden bu durum "public değil" sayılıp yanlışlıkla tam AppShell'i
 * mount ediyordu, 404 gibi hafif bir sayfada gereksiz WS/skor motoru
 * maliyeti.
 *
 * Bu route'larda AppShell'in DIŞINDA kalanlar (RootLayout'ta, hep
 * mevcut): ClerkProvider, I18nProvider (useT çalışmaya devam eder),
 * SonnerToaster, tema/font CSS class'ları.
 *
 * Bilerek kaybolanlar: ThemeSync/DevicePerfSync (kritik değil —
 * RootLayout'taki inline FOUC-önleyici script data-theme'i zaten
 * hydration öncesi localStorage'dan set ediyor), AppHeader/BottomNav
 * (trading nav'ı, bu sayfalarda zaten anlamsız), MasterPinModal (henüz
 * giriş yapmamış kullanıcıda gösterilmesi zaten yanlış olurdu),
 * safe-area-inset padding (küçük bir görsel regresyon riski — bu
 * route'lar için ayrıca eklenmedi).
 *
 * AppShell next/dynamic İLE YÜKLENİYOR (perf teşhisinde bulundu — bkz.
 * "Kullanılmayan JavaScript 256 KiB" raporu): eskiden statik
 * `import { AppShell } from "./AppShell"` kullanılıyordu — bu, runtime'daki
 * isPublicRoute() kontrolünden BAĞIMSIZ olarak, AppShell'in TÜM bağımlılık
 * ağacını (20 hook + skor motoru + WS client'ları) HER route'un JS
 * bundle'ına (public route'lar dahil) dahil ediyordu; "if" kontrolü
 * sadece render'ı engelliyordu, indirmeyi değil. dynamic() bunu ayrı bir
 * chunk'a böler — sadece AppShell gerçekten render edildiğinde indirilir.
 *
 * BİLEREK ssr:false YOK — ilk versiyon ssr:false kullanıyordu ama bu,
 * AppShell'i gerektiren TÜM route'ları (/karar, /grafik, vb.) da SSR'sız
 * bırakıyordu; istenmeyen, çok geniş bir yan etkiydi, ayrı bir turda
 * kaldırıldı. ssr:false olmadan da code-splitting kazanımı (public
 * route'lar AppShell'in chunk'ını hiç istemiyor) aynen korunuyor, sadece
 * AppShell'i gerektiren route'larda sunucu tarafı render'ı devam ediyor.
 * SSR-güvenlik doğrulaması: AppShell'in TÜM hook'ları (useMarketStream,
 * useLiqFeed, useCapacitorApp/Push dahil) tek tek incelendi — browser
 * API erişimleri ya useEffect içinde (SSR'da hiç çalışmaz, React'in
 * garantisi) ya da açık `typeof window`/`typeof document` guard'ları
 * arkasında (ör. isNativePlatform() kendi belgesinde "SSR safe — server'da
 * her zaman false döner" diyor). Daha da güçlü kanıt: bu AYNI AppShell
 * component ağacı (AppHeader/BottomNav/DisclaimerModal/MasterPinModal/
 * PositionRiskBanner/NewsFeedBanner/QuickTradeSheet dahil), bu route-gating
 * turundan ÖNCE, projenin tüm geçmişi boyunca root layout'ta koşulsuz
 * SSR ediliyordu — hiç sorun çıkarmadı.
 */

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { DisclaimerModal } from "./DisclaimerModal";
import { isPublicRoute, isAppRoute } from "@/lib/routes/publicRoutes";

const AppShell = dynamic(() => import("./AppShell").then((m) => m.AppShell));

export function RouteAwareShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname();

  if (isPublicRoute(pathname)) {
    return (
      <>
        {pathname === "/track-record" && <DisclaimerModal />}
        {children}
      </>
    );
  }

  // Gerçek 404 — bilinen bir public route DA değil, AppShell gerektiren
  // bilinen bir app route DA değil (bkz. lib/routes/publicRoutes.ts).
  // AppShell'i (WS bağlantıları, skor motoru, 20+ poller/alert hook'u)
  // mount etmeye değmez, tıpkı public route'lar gibi hafif yoldan geçilir.
  // Bu, app/not-found.tsx'in artık build-time'da statik üretilebilmesinin
  // (force-dynamic gerekmemesinin) ön koşulu: AppHeader → UserButton
  // (@clerk/nextjs), yani request-time auth context ihtiyacı, sadece
  // AppShell mount edildiğinde devreye giriyordu.
  if (!isAppRoute(pathname)) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
