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
  appId: "com.quantixos.trading",
  appName: "QUANTIX OS",
  webDir: "public",

  server: {
    url: "https://www.quantixos.com",
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

  },

  // "App: { launchUrl: "/karar" }" ve "ios: { minVersion: "16.0" }" burada
  // kaldırıldı — WebSearch ile doğrulandı (CI'ın TS2353 hatası + Capacitor
  // resmi dokümantasyonu): ikisi de yeniden adlandırılmış değil, HİÇ VAR
  // OLMAMIŞ config alanları. App plugin'inin gerçek config tipi sadece
  // `disableBackButtonHandler` taşıyor — "launchUrl" hiçbir sürümde bir
  // config dosyası alanı olmadı, App plugin'in gerçek karşılığı runtime'da
  // çağrılan getLaunchUrl()/appUrlOpen event'i. iOS minimum sürümü
  // Capacitor'da hiç capacitor.config.ts'ten yönetilmiyor — Xcode projesinin
  // kendi "iOS Deployment Target" ayarından geliyor. Yani bu iki satır
  // muhtemelen hiçbir zaman gerçek bir etkisi olmayan, sessizce ölü kod
  // olarak buradaydı (tıpkı dün geceki ignoreDeprecations "6.0" gibi —
  // tsc hiç gerçek çalışmadığı için hiç yakalanmamıştı). Eğer "uygulama
  // /karar'a açılsın" ya da "iOS 16.0 altı desteklenmesin" davranışı hâlâ
  // isteniyorsa, bu AYRI bir iş — ilki gerçek runtime navigasyon mantığı,
  // ikincisi Xcode proje ayarı gerektirir, ikisi de bu dosyanın kapsamı
  // dışında.
  ios: {
    contentInset: "always",
    backgroundColor: "#0A0A0A",
    scheme: "quantixos",
  },

  android: {
    backgroundColor: "#0A0A0A",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
