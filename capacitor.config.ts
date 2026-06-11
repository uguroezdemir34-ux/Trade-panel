import type { CapacitorConfig } from "@capacitor/cli";

/**
 * CAPACITOR CONFIG — QUANTIX OS native app wrapper.
 *
 * Native build adımları:
 *   1. npm install
 *   2. npx cap add ios      (macOS + Xcode gerekir)
 *   3. npx cap add android  (Android Studio gerekir)
 *   4. npx cap sync         (web assets'i native'e kopyala)
 *   5. npx cap open ios     (Xcode'u aç + App Store'a gönder)
 *   6. npx cap open android (Android Studio'yu aç + Play Store'a gönder)
 *
 * Önemli:
 *   - server.url → deployed Vercel URL'sine yönlendirir
 *   - webDir → offline-capable statik fallback (npx next export ile üret)
 *   - Apple Developer Account ($99/yıl) + Google Play ($25) gerekir
 *   - Trading uygulamaları App Store'da özel kategori gerektirebilir
 */

const isProd = process.env.NODE_ENV === "production";
const serverUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://quantix-os-new.vercel.app";

const config: CapacitorConfig = {
  appId: "com.quantixos.trading",
  appName: "QUANTIX OS",
  webDir: "out",

  server: {
    // Production: deployed Vercel URL kullan (API routes için gerekli)
    // Development: localhost:3000
    url: serverUrl,
    cleartext: false,
    androidScheme: "https",
    // iOS'ta CORS sorunları için
    allowNavigation: [serverUrl.replace("https://", ""), "*.quantixos.com"],
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0A0A0A",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

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
    backgroundColor: "#0A0A0A",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: !isProd,
  },
};

export default config;
