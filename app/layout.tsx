import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
// @fontsource/ibm-plex-mono 4 ağırlık import'u BURADAN app/karar/layout.tsx'e
// taşındı (perf teşhisinde bulundu: paylaşım kartı — ShareButton.tsx →
// exportShareCard.ts — sadece /karar'da kullanılıyor, ama bu 4 render-blocking
// CSS dosyası önceden koşulsuz HER sayfada, /sign-in dahil, yükleniyordu).
// Detay için app/karar/layout.tsx ve exportShareCard.ts dosya başı yorumuna bkz.
import { fontVariables } from "@/lib/fonts";
import { ClerkClientWrapper } from "@/lib/auth/ClerkClientWrapper";
import { RouteAwareShell } from "@/components/layout/RouteAwareShell";
import { I18nProvider } from "@/lib/i18n/context";
import { LocaleHtmlSync } from "@/components/layout/LocaleHtmlSync";
import { BRAND_META } from "@/lib/brand";
import { SonnerToaster } from "@/components/layout/SonnerToaster";

export const metadata: Metadata = {
  title: BRAND_META.title,
  description: BRAND_META.description,
  keywords: BRAND_META.keywords,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QUANTIX",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-icon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: BRAND_META.title,
    description: BRAND_META.description,
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: BRAND_META.title,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_META.title,
    description: BRAND_META.description,
    images: ["/og-image.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Çentik/gesture-bar'lı cihazlarda env(safe-area-inset-*) değerlerinin
  // sıfır dönmesini engeller — bu olmadan globals.css'teki safe-area
  // kuralları hiçbir şey yapmaz.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // middleware.ts'in her istekte ürettiği, CSP script-src'nin izin verdiği
  // tek kullanımlık nonce — aşağıdaki iki inline <script>'e enjekte edilir.
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <html lang="tr" dir="ltr" suppressHydrationWarning translate="no">
        <head>
          {/* Webpack CSP nonce köprüsü (05 Ağu 2026 — CSP enforce canlı kırılması
              teşhisi): middleware.ts'in ürettiği nonce, script-src'de
              'strict-dynamic' ile birlikte veriliyor — bu, bir betiğin sadece
              GÜVENİLİR (nonce'lu) bir betik tarafından DOM'a eklenmişse
              güvenilir sayılmasını sağlıyor. Next/webpack'in next/dynamic()
              ile sonradan yüklediği kod-bölünmüş chunk'lar (örn. /grafik'in
              PriceChart'ı) `document.createElement('script')` ile DOM'a
              ekleniyor — bu enjeksiyonun GÜVENİLİR sayılması için webpack'in
              kendi runtime'ının nonce'u bilmesi gerekiyor. Next.js SSR'ın
              KENDİ ürettiği ilk script tag'lerine nonce eklemesi (App
              Router'ın belgelenmiş davranışı) bunu KAPSAMIYOR — o sadece
              ilk yükte var olan tag'ler için, webpack'in runtime'ının
              SONRADAN dinamik olarak enjekte ettiği chunk'lar için ayrıca
              `__webpack_nonce__` global'i set edilmesi gerekiyor (webpack'in
              resmi CSP desteği, bkz. webpack docs "content security policy").
              Bu satır olmadan strict-dynamic zinciri next/dynamic() ile
              yüklenen HER chunk'ta kopuyor — Sentry'de görülen "/grafik"
              ihlali bunun kanıtı. Diğer olası kırılan sayfalar (backtest,
              analiz — next/dynamic kullanan) henüz gözlenmedi ama aynı
              kök nedene bağlı olabilir; bu tek satır hepsini kapsıyor.
              Nonce başına tek kullanımlık — reuse riski yok, döngü değeri
              her istekte middleware'de yeniden üretiliyor. */}
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: `window.__webpack_nonce__=${JSON.stringify(nonce)};`,
            }}
          />
          {/* Prevent theme FOUC — reads localStorage before React hydrates */}
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: `try{var t=localStorage.getItem('ug52_theme');var v=t?JSON.parse(t):'dark';document.documentElement.setAttribute('data-theme',v);document.documentElement.style.colorScheme=(v==='light'?'light':'dark');}catch(e){}`,
            }}
          />
          {/* DEBUG: Visible error overlay for Android WebView black screen diagnosis.
              Active in development only — stripped from production build. */}
          {process.env.NODE_ENV === "development" && (
            <script
              nonce={nonce}
              dangerouslySetInnerHTML={{
                __html: `(function(){var _e=[];function _show(){var b=document.body;if(!b){setTimeout(_show,80);return;}var el=document.getElementById('__qx_err');if(!el){el=document.createElement('div');el.id='__qx_err';el.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:#cc0000;color:#fff;padding:14px;z-index:2147483647;overflow:auto;font-family:monospace;font-size:11px;word-break:break-all;white-space:pre-wrap;';b.insertBefore(el,b.firstChild);}el.textContent=_e.join('\\n\\n--- ---\\n\\n');}function _add(m){_e.push(m);_show();}window.onerror=function(m,s,l,c,err){_add('[ERR] '+m+'\\n'+s+':'+l+':'+c+(err&&err.stack?'\\n'+err.stack:''));return false;};window.addEventListener('unhandledrejection',function(ev){var r=ev.reason;_add('[PROMISE] '+(r&&r.message?r.message:String(r))+(r&&r.stack?'\\n'+r.stack:''));});setTimeout(function(){var b=document.body;var ok=b&&Array.from(b.children).some(function(c){return c.id!=='__qx_err';});if(!ok)_add('[TIMEOUT 8s] App yuklenmedi. Toplam hata: '+_e.length);},8000);})();`,
              }}
            />
          )}
        </head>
        <body className={`bg-bg text-text-t1 font-sans antialiased ${fontVariables}`}>
          <SonnerToaster />
          <ClerkClientWrapper nonce={nonce}>
            <I18nProvider>
              <LocaleHtmlSync />
              <RouteAwareShell>{children}</RouteAwareShell>
            </I18nProvider>
          </ClerkClientWrapper>
        </body>
      </html>
  );
}
