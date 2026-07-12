"use client";

/**
 * SQUEEZE RADAR BANNER — volatilite sıkışması gösteren coinlerin "Badge
 * Matrix" görünümü. scoreStore'a hiç dokunmaz, sadece candleStore'daki 1h
 * mumlardan türetir (allResults/allTicks gibi mevcut bileşenlerin okuduğu
 * diğer store'larla aynı "tüm map'i oku, useMemo'da filtrele" deseni —
 * bkz. goPairs/marketPulseIndex). useScoreEngine'e hiç dokunmaz.
 *
 * onSelect (opsiyonel): rozete tıklanınca çağrılır — sıkışma/anomali tespit
 * mantığına dokunmaz, sadece ScoreHeatmap/pair-grid kartlarındaki
 * onSelect={setActivePair} deseniyle aynı şekilde coin seçimini dışarı
 * bildirir. Verilmezse rozetler tıklanabilir kalır ama hiçbir şey olmaz.
 *
 * Balina/Anomali glow: her pair için computeOiCollapseAnomaly() +
 * computeOrderBookWallAnomaly() (lib/score/anomalyDetector.ts, DEĞİŞTİRİLMEDİ)
 * çağrılır — scoreStore/macroStore/orderBookStore'dan İMPERATİF olarak
 * (getState(), reactive subscription DEĞİL) okunur, ScoreHeatmap.tsx'teki
 * ile aynı desen: bu store'lara yeni bir subscription eklemek component'i
 * gereksiz sıklıkta yeniden render ederdi, tetikleyici hâlâ SADECE
 * candleStore (squeezeRadar'ın zaten var olan cadence'i).
 *
 * Tema notu: Bu projede light/dark geçişi Tailwind'in `dark:` varyantıyla
 * DEĞİL, `[data-theme]` + CSS değişkenleriyle yapılıyor (Tailwind'in
 * `dark:` varyantı sadece OS `prefers-color-scheme`'e bakar, uygulamanın
 * kendi tema seçiciyle senkron değildir — bu proje genelinde daha önce
 * tespit edilip düzeltilmiş bir desen, bkz. CLAUDE.md §9 Cyber-Terminal
 * notu). Bu yüzden badge arka planı `dark:` yerine mevcut theme-aware
 * token'larla (`bg-bg-card2`, `border-border`) yapıldı — light/dark/
 * cyber-terminal'in hepsinde doğru otomatik geçiş sağlıyor.
 *
 * "glass-panel" class'ı sadece cyber-terminal temasında aktif olur
 * (backdrop-blur, bkz. globals.css) — light/dark'ta hiçbir etkisi yok.
 */

import { useMemo } from "react";
import { useCandleStore } from "@/lib/store/candleStore";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useMacroStore } from "@/lib/store/macroStore";
import { useOrderBookStore } from "@/lib/store/orderBookStore";
import { useT } from "@/lib/i18n/context";
import { computeSqueezeRadar, type SqueezeRadarEntry } from "@/lib/market/squeezeRadar";
import { computeOiCollapseAnomaly, computeOrderBookWallAnomaly } from "@/lib/score/anomalyDetector";
import type { Pair } from "@/lib/constants/pairs";

interface SqueezeBadgeEntry extends SqueezeRadarEntry {
  isAnomaly: boolean;
}

/** onSelect verilmezse rozetler eskisi gibi salt-okunur kalır (opsiyonel, geriye dönük uyumlu). */
export function SqueezeRadarBanner({
  onSelect,
}: {
  onSelect?: (pair: Pair) => void;
} = {}): React.ReactElement | null {
  const t = useT();
  const allCandles = useCandleStore((s) => s.candles);

  const entries = useMemo<SqueezeBadgeEntry[]>(() => {
    const list = computeSqueezeRadar(allCandles);
    if (list.length === 0) return [];

    // İmperatif okuma — bu store'lara subscribe olmuyoruz, tetikleyici
    // hâlâ sadece allCandles (mevcut squeeze radar cadence'i korunuyor).
    const results = useScoreStore.getState().results;
    const oiVelocity = useMacroStore.getState().oiVelocity;
    const imbalance = useOrderBookStore.getState().imbalance;

    return list.map((e) => {
      const result = results[e.pair];
      const isAnomaly =
        computeOiCollapseAnomaly(result, oiVelocity[e.pair] ?? null) ||
        computeOrderBookWallAnomaly(result, imbalance[e.pair] ?? null);
      return { ...e, isAnomaly };
    });
  }, [allCandles]);

  if (entries.length === 0) return null;

  return (
    <div
      className="glass-panel border-border bg-bg-card/40 flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs"
      title={t("karar.squeezeRadarDesc")}
    >
      <span className="text-text-t3 shrink-0 text-2xs tracking-widest uppercase">
        {t("karar.squeezeRadarLabel")}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((e) => (
          <button
            key={e.pair}
            type="button"
            onClick={() => onSelect?.(e.pair)}
            className={[
              "bg-bg-card2 inline-flex items-baseline gap-1 rounded-md border px-2 py-1 transition-colors",
              onSelect ? "cursor-pointer hover:border-brand/60" : "",
              e.isAnomaly
                ? "border-purple-500/50 shadow-[0_0_8px_rgba(168,85,247,0.35)]"
                : "border-border",
            ].join(" ")}
          >
            <span className="text-text-t1 text-xs font-semibold">{e.pair}</span>
            <span className="text-text-t3 text-[10px] opacity-70">P{e.percentile}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
