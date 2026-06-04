/**
 * STAT-ARB SPREAD ANALİZİ — Geçmiş veri üzerinde spread davranışı.
 *
 * ÖNEMLİ: Bu bir kointegrasyon testi değildir.
 * ADF (Augmented Dickey-Fuller) veya Johansen testi uygulanmaz.
 * Yalnızca z-score eşiği aşımlarını simüle eder — "spread analizi".
 *
 * Gerçek kointegrasyon testi için istatistiksel yazılım (Python/R) gereklidir.
 */

import type { Candle } from "@/lib/okx/candles";
import type { StatArbConfig } from "@/lib/indicators/stat-arb";
import {
  computeSpreadSeries,
  computeZScore,
  estimateHedgeRatio,
  computePairCorrelation,
  STAT_ARB_DEFAULTS,
} from "@/lib/indicators/stat-arb";
import type { PricePair } from "@/lib/indicators/stat-arb";

// ─── Tipler ──────────────────────────────────────────────────

export interface StatArbTrade {
  entryTs: number;
  exitTs: number;
  side: "long_A_short_B" | "short_A_long_B";
  entryZScore: number;
  exitZScore: number;
  /** Spread değişimi (exit - entry, normalize için /std kullanılır) */
  spreadPnl: number;
  /** Yaklaşık % getiri (spread reversion / entry|z| oranı) */
  returnPct: number;
  exitReason: "mean_reversion" | "emergency" | "timeout";
  barsHeld: number;
}

export interface StatArbBacktestResult {
  pairA: string;
  pairB: string;
  /** Kullanılan hedge ratio */
  hedgeRatio: number;
  /** Log return korelasyonu */
  correlation: number | null;
  /** Toplam trade sayısı */
  totalTrades: number;
  /** Kazanan trade oranı */
  winRate: number;
  /** Ortalama spread pnl */
  avgSpreadPnl: number;
  /** Ortalama tutma süresi (bar sayısı) */
  avgBarsHeld: number;
  /** Max ardışık kayıp */
  maxConsecutiveLoss: number;
  /** Trades */
  trades: StatArbTrade[];
  /** Z-score serisinin tamamı (chart için) */
  zScoreSeries: Array<{ timestamp: number; zScore: number; spread: number }>;
  /** Spread serisinin tamamı */
  spreadMean: number;
  spreadStd: number;
  /** Veri aralığı */
  dataFrom: number;
  dataTo: number;
  /** Uyarı: bu ADF değil, spread analizi */
  disclaimer: string;
}

// ─── Yardımcı: Mumları hizala ─────────────────────────────────

/** İki mum serisini timestamp'e göre inner join ile eşleştir */
function alignCandles(candlesA: readonly Candle[], candlesB: readonly Candle[]): PricePair[] {
  const mapB = new Map<number, number>();
  for (const c of candlesB) {
    mapB.set(c.ts, c.close);
  }

  const result: PricePair[] = [];
  for (const c of candlesA) {
    const priceB = mapB.get(c.ts);
    if (priceB !== undefined && c.close > 0 && priceB > 0) {
      result.push({ timestamp: c.ts, priceA: c.close, priceB });
    }
  }

  return result.sort((a, b) => a.timestamp - b.timestamp);
}

// ─── Ana backtest fonksiyonu ──────────────────────────────────

/**
 * Geçmiş mumlar üzerinde spread analizi çalıştır.
 *
 * @param pairAName  Pair A sembolü (display için)
 * @param pairBName  Pair B sembolü
 * @param candlesA   Pair A'nın onaylanmış 1h mumları (kronolojik)
 * @param candlesB   Pair B'nin onaylanmış 1h mumları
 * @param config     Stat-arb konfigürasyonu
 * @param maxTimeoutBars  Pozisyon için max bekleme (bar), sonra timeout çıkışı
 */
export function runStatArbBacktest(
  pairAName: string,
  pairBName: string,
  candlesA: readonly Candle[],
  candlesB: readonly Candle[],
  config: StatArbConfig = {},
  maxTimeoutBars = 72,
): StatArbBacktestResult | null {
  if (candlesA.length < 50 || candlesB.length < 50) return null;

  // Hizala
  const aligned = alignCandles(candlesA, candlesB);
  if (aligned.length < 50) return null;

  // Hedge ratio tahmin
  const hedgeRatio = estimateHedgeRatio(aligned) ?? config.hedgeRatio ?? 1.0;
  const correlation = computePairCorrelation(aligned);

  const cfg = {
    window: config.window ?? STAT_ARB_DEFAULTS.window,
    hedgeRatio,
    entryThreshold: config.entryThreshold ?? STAT_ARB_DEFAULTS.entryThreshold,
    exitThreshold: config.exitThreshold ?? STAT_ARB_DEFAULTS.exitThreshold,
    emergencyThreshold: config.emergencyThreshold ?? STAT_ARB_DEFAULTS.emergencyThreshold,
  };

  // Spread serisi
  const spreadSeries = computeSpreadSeries(aligned, cfg.hedgeRatio);
  const spreads = spreadSeries.map((s) => s.spread);

  // Z-score serisi ve simülasyon
  const zScoreSeries: Array<{ timestamp: number; zScore: number; spread: number }> = [];
  const trades: StatArbTrade[] = [];

  // Simülasyon durumu
  let inPosition = false;
  let positionSide: "long_A_short_B" | "short_A_long_B" = "long_A_short_B";
  let entryBar = 0;
  let entryZScore = 0;
  let entrySpread = 0;

  // Warmup: ilk window bar'ı geç
  const warmup = Math.max(cfg.window + 5, 20);

  for (let i = warmup; i < spreadSeries.length; i++) {
    const zResult = computeZScore(spreads.slice(0, i + 1), cfg.window);
    if (!zResult || !zResult.reliable) continue;

    const { zScore, spread, spreadStd } = zResult;
    zScoreSeries.push({ timestamp: spreadSeries[i].timestamp, zScore, spread });

    if (!inPosition) {
      // Giriş kontrolü
      if (zScore >= cfg.entryThreshold) {
        inPosition = true;
        positionSide = "short_A_long_B";
        entryBar = i;
        entryZScore = zScore;
        entrySpread = spread;
      } else if (zScore <= -cfg.entryThreshold) {
        inPosition = true;
        positionSide = "long_A_short_B";
        entryBar = i;
        entryZScore = zScore;
        entrySpread = spread;
      }
    } else {
      // Çıkış kontrolü
      const absZ = Math.abs(zScore);
      const barsHeld = i - entryBar;
      let shouldExit = false;
      let exitReason: StatArbTrade["exitReason"] = "mean_reversion";

      if (absZ >= cfg.emergencyThreshold) {
        shouldExit = true;
        exitReason = "emergency";
      } else if (absZ <= cfg.exitThreshold) {
        shouldExit = true;
        exitReason = "mean_reversion";
      } else if (barsHeld >= maxTimeoutBars) {
        shouldExit = true;
        exitReason = "timeout";
      }

      if (shouldExit) {
        const spreadPnl = positionSide === "long_A_short_B"
          ? entrySpread - spread  // long A: giriş spread küçük, çıkış büyük iyi değil; spread küçüldü = iyi
          : spread - entrySpread; // short A: giriş spread büyük, küçüldü = iyi

        // Yaklaşık % return: spreadPnl / spreadStd
        const returnPct = spreadStd > 0 ? (spreadPnl / spreadStd) * 100 : 0;

        trades.push({
          entryTs: spreadSeries[entryBar].timestamp,
          exitTs: spreadSeries[i].timestamp,
          side: positionSide,
          entryZScore,
          exitZScore: zScore,
          spreadPnl,
          returnPct,
          exitReason,
          barsHeld,
        });

        inPosition = false;
        entrySpread = 0;
      }
    }
  }

  if (trades.length === 0) {
    return {
      pairA: pairAName,
      pairB: pairBName,
      hedgeRatio,
      correlation,
      totalTrades: 0,
      winRate: 0,
      avgSpreadPnl: 0,
      avgBarsHeld: 0,
      maxConsecutiveLoss: 0,
      trades: [],
      zScoreSeries,
      spreadMean: 0,
      spreadStd: 0,
      dataFrom: aligned[0].timestamp,
      dataTo: aligned[aligned.length - 1].timestamp,
      disclaimer: "Bu ADF/Johansen kointegrasyon testi değil — z-score tabanlı spread analizi.",
    };
  }

  const winners = trades.filter((t) => t.spreadPnl > 0);
  const winRate = winners.length / trades.length;
  const avgSpreadPnl = trades.reduce((s, t) => s + t.spreadPnl, 0) / trades.length;
  const avgBarsHeld = trades.reduce((s, t) => s + t.barsHeld, 0) / trades.length;

  let maxLoss = 0;
  let streak = 0;
  for (const t of trades) {
    if (t.spreadPnl <= 0) {
      streak++;
      maxLoss = Math.max(maxLoss, streak);
    } else {
      streak = 0;
    }
  }

  // Spread istatistikleri (tüm seri)
  const allSpreads = spreadSeries.map((s) => s.spread);
  const mu = allSpreads.reduce((s, v) => s + v, 0) / allSpreads.length;
  const variance = allSpreads.reduce((s, v) => s + (v - mu) ** 2, 0) / allSpreads.length;

  return {
    pairA: pairAName,
    pairB: pairBName,
    hedgeRatio,
    correlation,
    totalTrades: trades.length,
    winRate,
    avgSpreadPnl,
    avgBarsHeld: Math.round(avgBarsHeld),
    maxConsecutiveLoss: maxLoss,
    trades,
    zScoreSeries,
    spreadMean: mu,
    spreadStd: Math.sqrt(variance),
    dataFrom: aligned[0].timestamp,
    dataTo: aligned[aligned.length - 1].timestamp,
    disclaimer: "Bu ADF/Johansen kointegrasyon testi değil — z-score tabanlı spread analizi.",
  };
}
