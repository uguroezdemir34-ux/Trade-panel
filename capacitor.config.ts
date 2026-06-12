import type { CapacitorConfig } from "@capacitor/cli";

/**
 * CAPACITOR CONFIG — QUANTIX OS native app wrapper.
 *
 * Mimari: remote (Vercel)
 *   - server.url → APK WebView doğrudan Vercel'i açar
 *   - webDir: "public" → Capacitor için zorunlu alan; server.url varken çalışma zamanında kullanılmaz
 *   - Clerk, API route'lar, SSR — hepsi Vercel tarafında çalışır, uyumluluk sorunu yok
 */

const config: CapacitorConfig = {
  appId: "com.quantixos.trading.test10",
  appName: "QUANTIX OS",
  webDir: "public",

  server: {
    url: "https://quantixos.io",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [
      "quantix-os-new.vercel.app",
      "quantixos.com",
      "*.quantixos.com",
      "quantixos.io",
      "*.quantixos.io",
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
      launchUrl: "/karar",
    },
  },

  ios: {
    contentInset: "always",
    backgroundColor: "#0A0A0A",
    scheme: "quantixos",
    minVersion: "16.0",
  },

  android: {
    backgroundColor: "#0A0A0A",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
