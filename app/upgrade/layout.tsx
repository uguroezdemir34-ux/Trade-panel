import type { Metadata } from "next";

// page.tsx "use client" — metadata sadece Server Component'te çalışıyor,
// bu yüzden bu ayrı layout üzerinden taşınıyor (Next.js'in resmi deseni).
// /upgrade sitemap.ts'te indekslenmesi istenen bir sayfa — bu metadata
// arama sonuçlarında görünecek gerçek başlık/açıklama.
export const metadata: Metadata = {
  title: "Planlar & Fiyatlandırma — QUANTIX OS",
  description: "QUANTIX OS Pro'ya yükseltin — tam erişim, gelişmiş sinyal ve backtest özellikleri.",
};

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
