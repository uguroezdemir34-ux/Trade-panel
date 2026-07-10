"use client";

/**
 * SCORE HEATMAP — 24 coin'in skor+yön özetini Bloomberg Terminal tarzı bir
 * grid'de gösterir. Hacme göre ilk 3 pair 2×2 "large" hücre — tam 3 katman
 * (isim solda + canlı fiyat sağda üstte, glow'lu büyük skor ortada, tam
 * %değişim rozeti altta). Kalan 21 pair kompakt "normal" hücre — sadece
 * isim + skor + küçük bir yön oku (▲/▼, tam yüzde yok). Bu ikili ayrım
 * bilinçli: 360px genişlikte normal hücrelere (~80px) 3 tam katman
 * sığdırmak taşma riski taşıyordu (kullanıcı onayıyla netleştirildi) —
 * sadece large hücreler (2×2, ~170px) bu yoğunluğu güvenle taşıyor.
 *
 * Tetiklenme: sadece scoreStore.results değiştiğinde (yani zaten
 * useScoreEngine'in candle-close cadence'inde) — sürekli animasyon yok.
 * Hacim/fiyat verisi marketStore'dan İMPERATIF olarak (useMarketStore.
 * getState(), reactive subscription DEĞİL) okunur — bu, WS tick'lerinin
 * component'i yeniden tetiklemesini engeller, tetikleyici hâlâ SADECE
 * allResults (candle-close cadence korunuyor).
 *
 * Performans kısıtı (bilinçli, Görsel Kalite Paketi araştırmasının sonucu
 * — bkz. CLAUDE.md §9): hesaplama render'ın senkron yolunda değil,
 * requestIdleCallback'e (setTimeout(0) fallback — useScoreEngine.ts'teki
 * yieldToEventLoop ile aynı desen) ertelenmiş bir effect içinde çalışır.
 *
 * Saf hesaplama lib/market/heatmapLayout.ts'te — bu component sadece
 * zamanlama + render. useScoreEngine/orchestrator'a hiç dokunmaz.
 *
 * "glass-panel" class'ı sadece cyber-terminal temasında aktif olur
 * (backdrop-blur, bkz. globals.css) — light/dark'ta hiçbir etkisi yok.
 */

import { useEffect, useState } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useLocale } from "@/lib/i18n/context";
import { formatTickPrice, formatPercent } from "@/lib/i18n/format";
import { computeHeatmapCells, glowShadowFor, type HeatmapCell } from "@/lib/market/heatmapLayout";
import type { Pair } from "@/lib/constants/pairs";

function scheduleIdle(cb: () => void): void {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => cb(), { timeout: 200 });
  } else {
    setTimeout(cb, 0);
  }
}

interface ScoreHeatmapProps {
  onSelect: (pair: Pair) => void;
}

export function ScoreHeatmap({ onSelect }: ScoreHeatmapProps): React.ReactElement | null {
  const allResults = useScoreStore((s) => s.results);
  const locale = useLocale();
  const [cells, setCells] = useState<HeatmapCell[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    scheduleIdle(() => {
      if (cancelled) return;
      // İmperatif okuma — marketStore'a subscribe olmuyoruz, WS tick'leri
      // bu effect'i tetiklemesin diye (tetikleyici sadece allResults kalsın).
      const ticks = useMarketStore.getState().prices;
      setCells(computeHeatmapCells(allResults, ticks));
    });
    return () => {
      cancelled = true;
    };
  }, [allResults]);

  if (!cells || cells.length === 0) return null;

  return (
    <div className="glass-panel border-border bg-bg-card/40 grid grid-cols-4 auto-rows-[56px] grid-flow-row-dense gap-1 rounded-lg border p-2">
      {cells.map((cell) => {
        const isLarge = cell.size === "large";
        const chgUp = cell.chg !== null && cell.chg >= 0;
        const chgColor = cell.chg === null ? "" : chgUp ? "text-signal-up" : "text-signal-down";
        const chgSign = cell.chg === null ? null : chgUp ? "+" : "−";
        const chgArrow = cell.chg === null ? null : chgUp ? "▲" : "▼";
        // Glow sadece "large" hücrelerde — colorClassFor() değişmedi, bu ayrı bir görsel katman
        const glow = isLarge ? glowShadowFor(cell.verdict, cell.direction) : undefined;

        return (
          <button
            key={cell.pair}
            onClick={() => onSelect(cell.pair)}
            className={[
              "flex flex-col items-center justify-center overflow-hidden rounded text-center font-mono transition-colors",
              cell.colorClass,
              // Padding branch'e göre koşullu — px-1.5/py-1 ve p-3 aynı base string'de
              // birlikte durursa Tailwind'in derlenmiş sırasına göre biri sessizce
              // diğerini ezebilir, bu yüzden ikisi asla aynı anda mevcut değil.
              isLarge ? "col-span-2 row-span-2 gap-0.5 p-3 text-[11px]" : "px-1.5 py-1 text-[10px]",
            ].join(" ")}
          >
            {isLarge ? (
              <>
                {/* Üst satır — isim sol, canlı fiyat sağ (sadece large — bkz. dosya üstü not) */}
                <div className="flex w-full items-baseline justify-between gap-1">
                  <span className="truncate font-medium">{cell.pair}</span>
                  {cell.price !== null && (
                    <span className="text-text-t3 shrink-0 truncate text-[0.7em] opacity-90">
                      {formatTickPrice(cell.price, locale)}
                    </span>
                  )}
                </div>

                {/* Orta — skor, text-shadow glow */}
                <div className="text-lg font-bold leading-none" style={glow ? { textShadow: glow } : undefined}>
                  {cell.score}
                </div>

                {/* Alt satır — tam %değişim rozeti, +/- işaretli */}
                {cell.chg !== null && (
                  <div className={`w-full truncate text-center text-[0.75em] font-semibold ${chgColor}`}>
                    {chgSign}
                    {formatPercent(Math.abs(cell.chg), locale)}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Normal hücre — sadece isim + skor + küçük yön oku, taşma riskine karşı sade */}
                <div className="w-full truncate font-bold">{cell.pair}</div>
                <div className="text-[9px] leading-none opacity-80">{cell.score}</div>
                {chgArrow && (
                  <span className={`text-[8px] leading-none ${chgColor}`} aria-label="24h change">
                    {chgArrow}
                  </span>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
