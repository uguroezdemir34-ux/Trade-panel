import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

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
  // ediyoruz — glob değil, kullanılan dosyaların tam yolu (paket ~14 dosya
  // taşıyor, italik varyantlar dahil ~2MB; bize gereken beşi ~540KB).
  // package.json DAHİL — resolveFontPackageRoot() paket kökünü
  // require.resolve(paket + "/package.json") ile buluyor, bu dosya
  // izlemede yoksa çözümleme deploy'da başarısız olur (yerelde sorun
  // görünmez, çünkü node_modules zaten diskte tam halde durur).
  // Not: exportShareCardServer.ts'i çağıran her yeni route bu anahtara
  // kendi yolunu eklemeli (şu an sadece geçici debug route var).
  outputFileTracingIncludes: {
    "/api/debug/share-card": [
      "./node_modules/@expo-google-fonts/ibm-plex-mono/package.json",
      "./node_modules/@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf",
      "./node_modules/@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf",
      "./node_modules/@expo-google-fonts/ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf",
      "./node_modules/@expo-google-fonts/ibm-plex-mono/700Bold/IBMPlexMono_700Bold.ttf",
    ],
  },
};

// Bundle analyzer — ANALYZE=true ile koşulur, normal build'de no-op.
//   npm run analyze
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: true,
});

export default withBundleAnalyzer(nextConfig);
