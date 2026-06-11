import type { CapacitorConfig } from "@capacitor/cli";

/**
 * CAPACITOR CONFIG — QUANTIX OS native app wrapper.
 *
 * Mimari: local assets (APK'ya gömülü)
 *   - webDir: "out"  →  next build (NEXT_OUTPUT=export) çıktısı APK'ya kopyalanır
 *   - server.url YOK  →  uygulama kendi içindeki dosyaları açar, Vercel'e bağlanmaz
 *   - API çağrıları (OKX, Clerk) hâlâ internete gider — sadece ilk yükleme lokale taşındı
 *
 * Mobil build:
 *   NEXT_OUTPUT=export npm run build   →  out/ üretir
 *   npx cap sync android               →  out/ → android/assets/public/ kopyalar
 */

const config: CapacitorConfig = {
  appId: "com.quantixos.trading.test7",
  appName: "QUANTIX OS",
  webDir: "out",

  server: {
    // No server.url — APK kendi out/ içeriğini açar
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [
      "quantix-os-new.vercel.app",
      "*.quantixos.com",
      "*.clerk.accounts.dev",
      "*.clerk.dev",
    ],
  },

  plugins: {
    StatusBar: {
      style: "Dark",
      backgroundColor: "#0A0A0A",
      overlaysWebView: false,
    },

    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },

    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true,
    },

    App: {
      // iOS'ta "swipe back" navigasyonu etkinleştir
      launchUrl: "/karar",
    },
  },

  ios: {
    contentInset: "always",
    backgroundColor: "#0A0A0A",
    scheme: "quantixos",
    // Minimum iOS 16 (Safe Area, Sheet API)
    minVersion: "16.0",
  },

  android: {
    // DIAGNOSTIC: kırmızı — eğer ekran kırmızıya dönerse WebView render ediyor demek
    backgroundColor: "#FF0000",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
