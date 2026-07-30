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
 */

import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";
import { DisclaimerModal } from "./DisclaimerModal";
import { isPublicRoute } from "@/lib/routes/publicRoutes";

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

  return <AppShell>{children}</AppShell>;
}
