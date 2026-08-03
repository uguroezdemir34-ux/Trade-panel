"use client";

/**
 * USE CHART SR LEVELS — Grafik sayfası için skorun GERÇEKTEN kullandığı S/R
 * seviyeleri.
 *
 * Önceki davranış (app/grafik/page.tsx buildSeries): açık olan sekmenin
 * mumlarında (hangi timeframe seçiliyse) naif findAllSwingHighs/Lows —
 * skoru belirleyen detectSRLevels() (4H+1H pivot, önceki gün/hafta, yuvarlak
 * sayı, lib/sr/detect.ts) ile HİÇ İLGİSİ yoktu. Bu hook onun yerine geçiyor.
 *
 * Yeni fetch/polling YOK: candleStore zaten useCandlePoller (AppShell'de
 * mount edilir, skor motoru için) tarafından TÜM parite × {15m,1h,4h,1d}
 * için sürekli güncel tutuluyor — burada sadece mevcut reaktif store'dan
 * okunuyor, grafikte hangi zaman dilimine bakılıyor olursa olsun (5m/15m/
 * 1h/4h/1d) S/R her zaman aynı (skorun gördüğü) kaynaktan gelir.
 *
 * direction="NEUTRAL" + volRatio=null bilerek geçiliyor: detectSRLevels'in
 * levels.resistances/supports listesi direction'dan BAĞIMSIZ hesaplanıyor
 * (sadece mevcut fiyata göre üstte/altta olma durumu) — modifier/
 * breakoutOverride (direction'a bağlı kısımlar) burada hiç kullanılmıyor,
 * saf görselleştirme. computeScore/orchestrator.ts'e hiç dokunulmadı.
 */

import { useMemo } from "react";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { detectSRLevels } from "@/lib/sr/detect";
import { findAllSwingHighs, findAllSwingLows } from "@/lib/sr/swing";
import { toIndicatorCandle } from "@/lib/okx/candles";
import type { Pair } from "@/lib/constants/pairs";
import type { SrLevel } from "@/lib/chart/types";

export function useChartSrLevels(pair: Pair): SrLevel[] {
  const candles4h = useCandleStore((s) => s.candles[`${pair}_4h`]) ?? EMPTY_CANDLES;
  const candles1h = useCandleStore((s) => s.candles[`${pair}_1h`]) ?? EMPTY_CANDLES;
  const candles15m = useCandleStore((s) => s.candles[`${pair}_15m`]) ?? EMPTY_CANDLES;
  const livePrice = useMarketStore((s) => s.prices[pair]?.last ?? null);

  return useMemo(() => {
    const c4hConfirmed = candles4h.filter((c) => c.confirm);
    const c1hConfirmed = candles1h.filter((c) => c.confirm);
    const c15mConfirmed = candles15m.filter((c) => c.confirm);
    if (c1hConfirmed.length < 10) return [];

    const currentPrice = livePrice ?? c1hConfirmed[c1hConfirmed.length - 1]?.close ?? 0;
    if (currentPrice <= 0) return [];

    const c4hInd = c4hConfirmed.map(toIndicatorCandle);
    const c1hInd = c1hConfirmed.map(toIndicatorCandle);
    const { levels } = detectSRLevels(c4hInd, c1hInd, currentPrice, "NEUTRAL", null);

    const fromScore: SrLevel[] = [
      ...levels.resistances.map((l) => ({ price: l.price, type: "resistance" as const, source: l.type })),
      ...levels.supports.map((l) => ({ price: l.price, type: "support" as const, source: l.type })),
    ];

    // Gerçek 15m swing — detectSRLevels 15m'yi hiç kapsamıyor. Mevcut naif
    // hesapla AYNI yöntem (findAllSwingHighs/Lows), ama artık gerçek 15m
    // veriden — önceden açık sekmenin mumlarından (hangi TF olursa) naif
    // olarak türetiliyordu.
    let fromSwing15m: SrLevel[] = [];
    if (c15mConfirmed.length >= 7) {
      const c15mInd = c15mConfirmed.map(toIndicatorCandle);
      const highs = findAllSwingHighs(c15mInd, 60, 3, 8);
      const lows = findAllSwingLows(c15mInd, 60, 3, 8);
      fromSwing15m = [
        ...highs.map((p) => ({ price: p.price, type: "resistance" as const, source: "swing_15m" as const })),
        ...lows.map((p) => ({ price: p.price, type: "support" as const, source: "swing_15m" as const })),
      ];
    }

    return [...fromScore, ...fromSwing15m];
  }, [candles4h, candles1h, candles15m, livePrice]);
}
