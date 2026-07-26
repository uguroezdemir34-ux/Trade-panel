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
};

// Bundle analyzer — ANALYZE=true ile koşulur, normal build'de no-op.
//   npm run analyze
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: true,
});

export default withBundleAnalyzer(nextConfig);
