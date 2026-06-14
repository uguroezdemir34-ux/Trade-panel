import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "@/components/layout/AppShell";
import { I18nProvider } from "@/lib/i18n/context";
import { LocaleHtmlSync } from "@/components/layout/LocaleHtmlSync";
import { BRAND_META } from "@/lib/brand";

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
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" dir="ltr" suppressHydrationWarning>
        <head>
          {/* Prevent theme FOUC — reads localStorage before React hydrates */}
          <script
            dangerouslySetInnerHTML={{
              __html: `try{var t=localStorage.getItem('ug52_theme');var v=t?JSON.parse(t):'dark';document.documentElement.setAttribute('data-theme',v);document.documentElement.style.colorScheme=v;}catch(e){}`,
            }}
          />
          {/* DEBUG: Visible error overlay for Android WebView black screen diagnosis.
              Shows JS errors on screen instead of silent black. Remove after fix. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var _e=[];function _show(){var b=document.body;if(!b){setTimeout(_show,80);return;}var el=document.getElementById('__qx_err');if(!el){el=document.createElement('div');el.id='__qx_err';el.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:#cc0000;color:#fff;padding:14px;z-index:2147483647;overflow:auto;font-family:monospace;font-size:11px;word-break:break-all;white-space:pre-wrap;';b.insertBefore(el,b.firstChild);}el.textContent=_e.join('\\n\\n--- ---\\n\\n');}function _add(m){_e.push(m);_show();}window.onerror=function(m,s,l,c,err){_add('[ERR] '+m+'\\n'+s+':'+l+':'+c+(err&&err.stack?'\\n'+err.stack:''));return false;};window.addEventListener('unhandledrejection',function(ev){var r=ev.reason;_add('[PROMISE] '+(r&&r.message?r.message:String(r))+(r&&r.stack?'\\n'+r.stack:''));});setTimeout(function(){var b=document.body;var ok=b&&Array.from(b.children).some(function(c){return c.id!=='__qx_err';});if(!ok)_add('[TIMEOUT 8s] App yuklenmedi. Toplam hata: '+_e.length);},8000);})();`,
            }}
          />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin=""
          />
          {/* IBM Plex (Latin/Cyrillic) + Noto Sans families for CJK, Arabic, Devanagari */}
          <link
            href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Sans+KR:wght@400;500;700&family=Noto+Sans+Arabic:wght@400;500;700&family=Noto+Sans+Devanagari:wght@400;500;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="bg-bg text-text-t1 font-sans antialiased">
          <I18nProvider>
            <LocaleHtmlSync />
            <AppShell>{children}</AppShell>
          </I18nProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
