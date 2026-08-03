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
 * okunuyor.
 *
 * direction="NEUTRAL" + volRatio=null bilerek geçiliyor: detectSRLevels'in
 * levels.resistances/supports listesi direction'dan BAĞIMSIZ hesaplanıyor
 * (sadece mevcut fiyata göre üstte/altta olma durumu) — modifier/
 * breakoutOverride (direction'a bağlı kısımlar) burada hiç kullanılmıyor,
 * saf görselleştirme. computeScore/orchestrator.ts'e hiç dokunulmadı.
 *
 * SEKME FİLTRESİ (kullanıcı kararı) — tüm kaynaklar HER ZAMAN hesaplanır
 * (detectSRLevels tam çağrılır) ama sadece o an açık olan timeframe
 * sekmesiyle eşleşen seviyeler DÖNDÜRÜLÜR: 15m'ye bakarken sadece gerçek
 * 15m swing, 4H'e bakarken sadece 4H pivot, vb. — hepsi bir arada değil.
 * ROUND (yuvarlak sayı) istisna: hiçbir candle timeframe'inden türemiyor
 * (sadece currentPrice'tan), bu yüzden her sekmede görünür kalıyor.
 * 5m/1m sekmelerinde bu haritada karşılığı yok → ROUND hariç hiçbir
 * seviye gösterilmez (o granülerlikte hesaplanan bir kaynak yok, sahte
 * bir eşleştirme uydurmak yerine boş bırakılıyor).
 *
 * PDH/PDL/PWH/PWL/ROUND — detectSRLevels()'İN DEDUP'LANMIŞ ÇIKTISINDAN
 * DEĞİL, kendi ham kaynağından (bkz. aşağıdaki fromPeriodRound). detectSRLevels
 * içindeki dedup ("aynı %0.3 aralığında İLK EKLENEN kazanır", sıra: 4H pivot
 * → 1H pivot → PDH/PDL/PWH/PWL → ROUND) skor için doğru ve KASITLI — hangi
 * "tip" olduğu skoru etkilemiyor, sadece en yakın seviyenin mesafesi/gücü
 * önemli. Ama bir PDH bir 4H/1H pivot'a yakınsa dedup'ta sessizce yutuluyor;
 * skor için zararsız, ama sekme-bazlı kaynak filtresi (TF_SOURCES) için
 * yıkıcı — 1D sekmesinde "sadece PDH/PDL" arıyoruz, dedup'ta yutulmuşsa hiç
 * bulunamıyor. Çözüm: PDH/PDL/PWH/PWL/ROUND için getPrevPeriodLevels()/
 * getRoundNumberLevels()'i (lib/sr/levels.ts, zaten pure + dedup'suz)
 * DOĞRUDAN çağırıyoruz — detectSRLevels()'in kendisine hiç dokunulmadı,
 * sadece 4H/1H pivot kısmı (fromScore, zaten doğru) onun çıktısından
 * kalıyor.
 */

import { useMemo } from "react";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { detectSRLevels } from "@/lib/sr/detect";
import { getPrevPeriodLevels, getRoundNumberLevels } from "@/lib/sr/levels";
import { findAllSwingHighs, findAllSwingLows } from "@/lib/sr/swing";
import { toIndicatorCandle, type Timeframe } from "@/lib/okx/candles";
import type { Pair } from "@/lib/constants/pairs";
import type { SrLevel, SrLevelSource } from "@/lib/chart/types";

const TF_SOURCES: Partial<Record<Timeframe, SrLevelSource[]>> = {
  "15m": ["swing_15m"],
  "1h": ["pivot_1h_high", "pivot_1h_low"],
  "4h": ["pivot_4h_high", "pivot_4h_low"],
  "1d": ["PDH", "PDL"],
  "1w": ["PWH", "PWL"],
};

export function useChartSrLevels(pair: Pair, timeframe: Timeframe): SrLevel[] {
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
    // detectSRLevels'in dedup'lu çıktısından sadece 4H/1H pivot kısmını
    // kullanıyoruz (zaten doğru çalışıyor) — PDH/PDL/PWH/PWL/ROUND'ı AŞAĞIDA
    // kendi ham kaynağından ayrıca ekliyoruz (bkz. dosya başı yorumu).
    const fromPivotOnly = fromScore.filter((l) => l.source.startsWith("pivot_"));

    // PDH/PDL/PWH/PWL/ROUND — dedup'suz, ham kaynak (bkz. dosya başı yorumu).
    const periodLevels = getPrevPeriodLevels(c4hInd);
    const roundLevels = getRoundNumberLevels(currentPrice);
    const fromPeriodRound: SrLevel[] = [
      ...periodLevels.map((l) => ({
        price: l.price,
        type: l.price > currentPrice ? ("resistance" as const) : ("support" as const),
        source: l.type,
      })),
      ...roundLevels.map((l) => ({
        price: l.price,
        type: l.price > currentPrice ? ("resistance" as const) : ("support" as const),
        source: "ROUND" as const,
      })),
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

    const combined = [...fromPivotOnly, ...fromPeriodRound, ...fromSwing15m];
    const allowed = TF_SOURCES[timeframe];
    return combined.filter((lvl) => lvl.source === "ROUND" || (allowed?.includes(lvl.source) ?? false));
  }, [candles4h, candles1h, candles15m, livePrice, timeframe]);
}
