import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// NEXT_OUTPUT=export → mobil APK static build (Capacitor webDir)
// Vercel deployment bu env var'ı set etmez — server-side rendering devam eder
const isMobileBuild = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  ...(isMobileBuild && {
    output: "export" as const,
    trailingSlash: true,  // Capacitor file:// routing için gerekli
  }),
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    APP_VERSION: "2.0.0",
  },
};

// Bundle analyzer — ANALYZE=true ile koşulur, normal build'de no-op.
//   npm run analyze
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: true,
});

export default withBundleAnalyzer(nextConfig);
