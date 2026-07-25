"use client";

/**
 * VERDICT BADGE — GO / WAIT / NO.
 * Büyük renkli pill, karar verici göstergesi.
 * 3D glossy gradient style — üst highlight, alt iç gölge, kabarık metalik his.
 *
 * GO teyit durumu (useSignalFirehose.ts'in CONFIRM_DELAY_MS bekleme
 * mekanizmasının UI yansıması, bkz. lib/store/signalConfirmStore.ts):
 * bu bileşen sadece GÖSTERİM yapar, teyit mantığını değiştirmez.
 */

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";

type Verdict = "go" | "wait" | "no";

type ConfirmStatus = "pending" | "confirmed" | "unknown";

/** ms → "4:12" biçimi. Negatif/0 → "0:00". */
function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * confirmPendingUntil/confirmConfirmedAt store'dan hiç dolmamışsa (sayfa
 * yenilenmiş, henüz ilk useSignalFirehose cycle'ı çalışmamış) durum
 * "unknown" — asla sessizce "confirmed" gibi davranılmaz (bkz. CLAUDE.md
 * §0.1 madde 3).
 */
function useConfirmStatus(
  verdict: Verdict,
  trackingApplies: boolean,
  pendingUntil: number | null | undefined,
  confirmedAt: number | null | undefined,
): { status: ConfirmStatus | null; remainingMs: number } {
  const active = verdict === "go" && trackingApplies;

  // "now"a bağlı OLMAYAN, sadece prop'lardan türeyen yapısal durum — sayaç
  // sadece bu "pending adayı" iken çalışsın diye (confirmed/unknown'da
  // saniyede bir gereksiz render tetiklememesi için, bkz. review notu).
  const structural: ConfirmStatus | null = !active
    ? null
    : confirmedAt != null
    ? "confirmed"
    : pendingUntil != null
    ? "pending"
    : "unknown";

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (structural !== "pending") return;
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [structural]);

  if (structural !== "pending") return { status: structural, remainingMs: 0 };
  if (pendingUntil! > now) return { status: "pending", remainingMs: pendingUntil! - now };
  // pendingUntil'ın süresi doldu ama confirmedAt henüz gelmedi (bir sonraki
  // useSignalFirehose cycle'ını bekleyen kısa geçiş anı) — "confirmed" diye
  // varsaymak yerine dürüstçe "bilinmiyor" göster.
  return { status: "unknown", remainingMs: 0 };
}

const GRADIENT_STYLES: Record<Verdict, React.CSSProperties> = {
  go: {
    background: "linear-gradient(180deg, #2fd068 0%, #1a9e42 42%, #0e7030 100%)",
    boxShadow:
      "inset 0 1px 0 rgba(180,255,200,0.38), inset 0 -2px 0 rgba(0,0,0,0.28), 0 2px 8px rgba(16,140,56,0.40)",
    border: "1px solid #0b5a26",
    color: "#fff",
  },
  wait: {
    background: "linear-gradient(180deg, #f2a832 0%, #cc7c18 42%, #9e5a08 100%)",
    boxShadow:
      "inset 0 1px 0 rgba(255,220,160,0.38), inset 0 -2px 0 rgba(0,0,0,0.28), 0 2px 8px rgba(180,100,16,0.40)",
    border: "1px solid #7a4406",
    color: "#fff",
  },
  no: {
    background: "linear-gradient(180deg, #e85555 0%, #c42222 42%, #9a0e0e 100%)",
    boxShadow:
      "inset 0 1px 0 rgba(255,180,180,0.38), inset 0 -2px 0 rgba(0,0,0,0.30), 0 2px 8px rgba(180,20,20,0.40)",
    border: "1px solid #7a0808",
    color: "#fff",
  },
};

const ICONS: Record<Verdict, string> = {
  go: "✓",
  wait: "⏸",
  no: "✕",
};

const LABEL_KEYS: Record<Verdict, string> = {
  go: "verdict.go",
  wait: "verdict.wait",
  no: "verdict.no",
};

export function VerdictBadge({
  verdict,
  signalType,
  hysteresisActive,
  hysteresisDetail,
  confirmTrackingApplies,
  confirmPendingUntil,
  confirmConfirmedAt,
}: {
  verdict: Verdict;
  signalType?: "classic" | "pullback";
  /** applyHysteresis() tetiklendi mi (bkz. ScoreResult.reasons.hysteresis) — "Kararlı Trend" rozeti gösterir. */
  hysteresisActive?: boolean;
  /** reasons.hysteresis'in ham metni — native title tooltip'te detay için, opsiyonel. */
  hysteresisDetail?: string;
  /** false (ör. demoMode) → GO teyit rozeti hiç uygulanmaz, her zaman normal görünüm. */
  confirmTrackingApplies?: boolean;
  /** signalConfirmStore.entries[pair]?.pendingUntil — bkz. dosya başı yorumu. */
  confirmPendingUntil?: number | null;
  /** signalConfirmStore.entries[pair]?.confirmedAt — bkz. dosya başı yorumu. */
  confirmConfirmedAt?: number | null;
}): React.ReactElement {
  const t = useT();
  const { status: confirmStatus, remainingMs } = useConfirmStatus(
    verdict,
    confirmTrackingApplies ?? false,
    confirmPendingUntil,
    confirmConfirmedAt,
  );

  // Görsel zayıflatma (opacity/gri) SADECE pending'e ait — orada sistem
  // gerçekten "henüz emin değilim" diyor. unknown, "sinyal hakkında olumsuz
  // bir şey bilmiyoruz, sadece takibi kaybettik" anlamına geliyor — pending'den
  // epistemik olarak daha az olumsuz, o yüzden daha güçsüz GÖRÜNMEMELİ.
  // Mobilde sık sık yenilenen bir sayfada en sık görülecek durum bu olacağı
  // için (bkz. review notu), yeşil GO görünümü korunuyor, sadece kesikli
  // çerçeve + etiket ekleniyor.
  const pillStyle: React.CSSProperties =
    confirmStatus === "pending"
      ? {
          ...GRADIENT_STYLES.go,
          opacity: 0.55,
          border: "1px dashed #0b5a26",
          boxShadow: "none",
        }
      : confirmStatus === "unknown"
      ? {
          ...GRADIENT_STYLES.go,
          border: "1px dashed rgba(255,255,255,0.6)",
        }
      : GRADIENT_STYLES[verdict];

  const pillLabel =
    confirmStatus === "pending"
      ? `${t(LABEL_KEYS.go)} · ${t("verdict.confirmPending")} ${formatCountdown(remainingMs)}`
      : confirmStatus === "unknown"
      ? `${t(LABEL_KEYS.go)} · ${t("verdict.confirmUnknown")}`
      : t(LABEL_KEYS[verdict]);

  return (
    <div className="flex items-center gap-2">
      <div
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-bold tracking-widest select-none"
        style={pillStyle}
      >
        <span>{ICONS[verdict]}</span>
        <span>{pillLabel}</span>
      </div>
      {signalType === "pullback" && (
        <span className="bg-soft-amber text-signal-amber rounded px-2 py-0.5 font-mono text-2xs tracking-wider">
          {t("verdict.pullback")}
        </span>
      )}
      {hysteresisActive && (
        <span
          className="inline-flex items-center gap-1 rounded border border-emerald-500/25 bg-emerald-500/8 px-2 py-0.5 font-mono text-2xs tracking-wide text-emerald-400/80"
          title={hysteresisDetail}
        >
          <span>🔗</span>
          <span>{t("karar.hysteresisStable")}</span>
        </span>
      )}
    </div>
  );
}
