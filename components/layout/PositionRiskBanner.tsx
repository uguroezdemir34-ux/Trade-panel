"use client";

/**
 * POSITION RISK BANNER — kaldıraç/SL ihlali tespit edilen açık pozisyonlar
 * için göz ardı edilemeyecek, kırmızı, AppShell-global banner.
 *
 * lib/store/positionRiskStore.ts'ten okur (usePositionPoller her fetch'te
 * günceller, bkz. lib/risk/positionGuardrails.ts). Sadece görsel/bilgilendirme
 * — hiçbir emri ENGELLEMİYOR: bu uygulamada bugün borsaya gerçek emir
 * gönderen bir kod yolu yok (lib/exchange/index.ts `getAdapter()` koşulsuz
 * throw ediyor — chat'te ayrıca araştırıldı, ANALYSIS.md'de de belgeli).
 * Koruma noktası "kullanıcı zaten borsada açmış bir pozisyonu tespit edip
 * uyar."
 *
 * Global (AppShell'de, /karar+/grafik'e sınırlı DEĞİL) — kullanıcı kararı:
 * "gerçek bir risk ihlali uyarısı başka sayfalarda gizlenmemeli."
 *
 * KASITLI OLARAK sticky/fixed DEĞİL, kapatma butonu YOK — AppHeader'ın
 * KENDİSİ sticky top-0 (z-50) kullanıyor; bu banner'ı da sticky top-0
 * yapmak, tarayıcıda test edilmeden (bu ortamda mümkün değil) offset
 * çakışması riski taşırdı (bkz. NewsFeedBanner.tsx'in bu yüzden kurduğu
 * ResizeObserver tabanlı ölçülü-offset sistemi — burada o karmaşıklığı
 * eklemek yerine en güvenli seçenek: AppHeader'dan ÖNCE, normal akışta,
 * sayfanın en tepesinde düz bir blok). violations boşsa hiç render
 * edilmez.
 */

import { usePositionRiskStore } from "@/lib/store/positionRiskStore";

export function PositionRiskBanner(): React.ReactElement | null {
  const violations = usePositionRiskStore((s) => s.violations);

  if (violations.length === 0) return null;

  return (
    <div
      role="alert"
      className="w-full bg-red-600 px-4 py-2 font-mono text-xs text-white sm:text-sm"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-1">
        {violations.map((v) => (
          <div key={v.key} className="flex items-center gap-2">
            <span aria-hidden>⚠️</span>
            <span className="font-bold">{v.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
