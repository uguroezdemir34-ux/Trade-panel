import type { MetadataRoute } from "next";

const SITE_URL = "https://quantixos.com";

/**
 * Sadece gerçekten indekslenmesi istenen, statik/genel içerikli sayfalar —
 * /sign-in, /sign-up, /invite/[code] (kişiselleştirilmiş referans linki),
 * /admin, /api/* bilerek dışarıda (bkz. app/robots.ts disallow listesi).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/upgrade`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
