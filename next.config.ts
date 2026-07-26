import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// exportShareCardServer.ts'in ihtiyaç duyduğu dosyalar — her iki route da
// (debug + telegram/signal) aynı setini istiyor, tek yerden tutuluyor.
const SHARE_CARD_TRACED_FILES = [
  "./node_modules/@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf",
  "./node_modules/@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf",
  "./node_modules/@expo-google-fonts/ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf",
  "./node_modules/@expo-google-fonts/ibm-plex-mono/700Bold/IBMPlexMono_700Bold.ttf",
  "./public/quantix-logo.png",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    APP_VERSION: "2.0.0",
  },
  // @napi-rs/canvas prebuilt native (.node) binary — Next.js'in bundle'a
  // gömmeye çalışmaması gerekiyor, sunucu tarafında require ile olduğu
  // gibi yüklenmeli (bkz. lib/share/exportShareCardServer.ts).
  serverExternalPackages: ["@napi-rs/canvas"],
  // exportShareCardServer.ts, @expo-google-fonts/ibm-plex-mono'nun .ttf
  // dosyalarını fs path'iyle runtime'da okuyor — hiçbir yerde import/require
  // edilmiyor, dolayısıyla Next'in otomatik dosya izleme (file tracing)
  // mekanizması bunları serverless fonksiyon paketine DAHİL ETMEZ; yerelde
  // çalışır ama Vercel'de "dosya bulunamadı" hatası verir. Açıkça dahil
  // ediyoruz — glob değil, kullanılan dört dosyanın tam yolu (paket ~14
  // dosya taşıyor, italik varyantlar dahil ~2MB; bize gereken dördü ~540KB).
  // package.json ARTIK GEREKMİYOR: exportShareCardServer.ts artık paket
  // kökünü require.resolve ile değil process.cwd() tabanlı sabit bir
  // node_modules yoluyla buluyor (require.resolve şablon dizeyle
  // çağrıldığında webpack modülü grafiğe eklemiyor, bu da Vercel'de
  // runtime çözümlemesini başarısız kılıyordu — kullanıcı tespiti).
  // Not: exportShareCardServer.ts'i çağıran her yeni route bu anahtara
  // kendi yolunu eklemeli — /api/telegram/signal artık trade_opened
  // sinyallerinde kart üretip fotoğraf olarak gönderiyor (bkz. route.ts).
  //
  // public/quantix-logo.png DA BURADA: aynı gerekçe font dosyalarıyla —
  // public/ Vercel'de ayrı bir statik CDN yoluyla sunuluyor, serverless
  // fonksiyonun kendi fs'i public/'a otomatik erişemeyebilir. Bu HENÜZ
  // gerçek bir deploy'da doğrulanmadı (font dosyalarında olduğu gibi
  // önce olmadan deneyip 404/bulunamadı hatası aldık) — burada aynı
  // hatayı önceden bilerek tekrar yaşamamak için proaktif eklendi, ama
  // §0.1 madde 2 gereği "doğrulandı" DENMİYOR, yalnızca tutarlı bir
  // varsayım uygulanıyor.
  outputFileTracingIncludes: {
    "/api/debug/share-card": SHARE_CARD_TRACED_FILES,
    "/api/telegram/signal": SHARE_CARD_TRACED_FILES,
  },
};

// Bundle analyzer — ANALYZE=true ile koşulur, normal build'de no-op.
//   npm run analyze
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: true,
});

export default withBundleAnalyzer(nextConfig);
