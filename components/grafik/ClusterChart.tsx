"use client";

/**
 * CLUSTER CHART — Fiyat seviyeleri bazında buy/sell hacim dağılımı.
 *
 * Footprint chart'ın basitleştirilmiş versiyonu: trade feed'deki son N işlemi
 * fiyat bucket'larına gruplar, her bucket'ta buy/sell notional gösterir.
 *
 * Veri kaynağı: tradeFeedStore → OKX WS trades kanalı (tüm 20 parite).
 *
 * Bucket boyutu: fiyatın ~%0.2'si kadar dinamik hesaplanır, "yuvarlak sayı"ya snap edilir.
 * Örn: BTC $60K → $100, ETH $3K → $5, SOL $150 → $0.20, XRP $0.5 → $0.001
 *
 * "Point of Control (POC)" = en yüksek toplam hacimli fiyat bölgesi.
 */

import { useMemo } from "react";
import { useTradeFeedStore } from "@/lib/store/tradeFeedStore";
import { useMarketStore } from "@/lib/store/marketStore";
import type { Pair } from "@/lib/constants/pairs";
import { formatTickPrice } from "@/lib/i18n/format";

/**
 * Fiyata göre dinamik bucket boyutu: fiyatın ~%0.2'si, "nice number"'a yuvarlanır.
 * 0.002 × price'ı büyüklük mertebesine göre snap eder (1 / 2 / 5 × 10^n).
 */
function computeBucketSize(price: number): number {
  if (!price || price <= 0) return 1;
  const raw = price * 0.002;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const nice = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  return nice * magnitude;
}

interface Bucket {
  priceMin: number;
  priceMax: number;
  buyUsd: number;
  sellUsd: number;
  totalUsd: number;
  delta: number;
}

function fmtK(usd: number): string {
  if (usd >= 1_000_000) return `${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000)     return `${(usd / 1_000).toFixed(0)}K`;
  return `${usd.toFixed(0)}`;
}

interface Props {
  pair: Pair;
  maxBuckets?: number;
}

export function ClusterChart({ pair, maxBuckets = 15 }: Props) {
  const feed      = useTradeFeedStore((s) => s.feeds[pair]);
  const livePrice = useMarketStore((s) => s.prices[pair]?.last ?? 0);

  const { buckets, poc, maxTotal } = useMemo(() => {
    const trades = feed?.buffer.items ?? [];
    if (!trades.length) return { buckets: [], poc: null, maxTotal: 1 };

    // Son bilinen fiyat yoksa son işlemin fiyatını kullan
    const refPrice = livePrice > 0 ? livePrice : (trades[trades.length - 1]?.price ?? 0);
    const bucketSize = computeBucketSize(refPrice);

    const map = new Map<number, Bucket>();

    for (const trade of trades) {
      const key = Math.floor(trade.price / bucketSize) * bucketSize;
      let b = map.get(key);
      if (!b) {
        b = { priceMin: key, priceMax: key + bucketSize, buyUsd: 0, sellUsd: 0, totalUsd: 0, delta: 0 };
        map.set(key, b);
      }
      if (trade.side === "buy") b.buyUsd += trade.notionalUsd;
      else                      b.sellUsd += trade.notionalUsd;
      b.totalUsd += trade.notionalUsd;
      b.delta = b.buyUsd - b.sellUsd;
    }

    const sorted = [...map.values()]
      .sort((a, b) => b.priceMin - a.priceMin)
      .slice(0, maxBuckets);

    const poc  = sorted.reduce<Bucket | null>((best, b) => (b.totalUsd > (best?.totalUsd ?? 0) ? b : best), null);
    const maxT = sorted.reduce((m, b) => Math.max(m, b.totalUsd), 1);

    return { buckets: sorted, poc, maxTotal: maxT };
  }, [feed, pair, maxBuckets, livePrice]);

  if (!buckets.length) {
    return (
      <div className="flex items-center justify-center h-48 text-text-t4 font-mono text-2xs">
        Veri bekleniyor…
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Legend */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-surface-s1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-mono text-2xs text-green-400">
            <span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> BUY
          </span>
          <span className="flex items-center gap-1 font-mono text-2xs text-red-400">
            <span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> SELL
          </span>
        </div>
        {poc && (
          <span className="font-mono text-2xs text-yellow-400">
            POC: {formatTickPrice(poc.priceMin)}–{formatTickPrice(poc.priceMax)}
          </span>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[80px_1fr_1fr_60px] gap-1 px-2 py-0.5 bg-surface-s1 border-b border-border">
        <span className="font-mono text-2xs text-text-t4">RANGE</span>
        <span className="font-mono text-2xs text-green-400">BUY</span>
        <span className="font-mono text-2xs text-red-400">SELL</span>
        <span className="font-mono text-2xs text-text-t4 text-right">DELTA</span>
      </div>

      {/* Bucket rows */}
      <div className="overflow-y-auto max-h-64 flex flex-col">
        {buckets.map((b) => {
          const buyPct   = (b.buyUsd / maxTotal) * 100;
          const sellPct  = (b.sellUsd / maxTotal) * 100;
          const isPoc    = poc !== null && b.priceMin === poc.priceMin;
          const deltaPct = b.totalUsd > 0 ? (b.delta / b.totalUsd) * 100 : 0;

          return (
            <div
              key={b.priceMin}
              className={`relative grid grid-cols-[80px_1fr_1fr_60px] gap-1 px-2 py-0.5 items-center ${
                isPoc ? "bg-yellow-500/5 border-l-2 border-yellow-500" : ""
              }`}
            >
              <span className={`font-mono text-2xs tabular-nums ${isPoc ? "text-yellow-400 font-bold" : "text-text-t3"}`}>
                {formatTickPrice(b.priceMin)}
                {isPoc && " ★"}
              </span>

              <div className="flex items-center gap-1">
                <div className="flex-1 h-3 bg-surface-s2 rounded-sm overflow-hidden">
                  <div className="h-full bg-green-500/70 transition-all duration-300" style={{ width: `${buyPct}%` }} />
                </div>
                <span className="font-mono text-2xs text-text-t4 w-10 text-right">{fmtK(b.buyUsd)}</span>
              </div>

              <div className="flex items-center gap-1">
                <div className="flex-1 h-3 bg-surface-s2 rounded-sm overflow-hidden">
                  <div className="h-full bg-red-500/70 transition-all duration-300" style={{ width: `${sellPct}%` }} />
                </div>
                <span className="font-mono text-2xs text-text-t4 w-10 text-right">{fmtK(b.sellUsd)}</span>
              </div>

              <span className={`font-mono text-2xs tabular-nums text-right ${
                deltaPct > 10 ? "text-green-400" : deltaPct < -10 ? "text-red-400" : "text-text-t4"
              }`}>
                {deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
