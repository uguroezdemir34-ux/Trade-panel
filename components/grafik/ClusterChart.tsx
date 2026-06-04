"use client";

/**
 * CLUSTER CHART — Fiyat seviyeleri bazında buy/sell hacim dağılımı.
 *
 * Footprint chart'ın basitleştirilmiş versiyonu: trade feed'deki son N işlemi
 * fiyat bucket'larına gruplar, her bucket'ta buy/sell notional gösterir.
 *
 * KISIT: Trade feed sadece BTC ve ETH için aktif.
 * Bucket boyutu: BTC → $100 aralık, ETH → $5 aralık.
 *
 * "Point of Control (POC)" = en yüksek toplam hacimli fiyat bölgesi.
 */

import { useMemo } from "react";
import { useTradeFeedStore } from "@/lib/store/tradeFeedStore";
import type { Pair } from "@/lib/constants/pairs";

const FEED_PAIRS = new Set<string>(["BTC", "ETH"]);

const BUCKET_SIZE: Record<string, number> = {
  BTC: 100,
  ETH: 5,
};

function getBucketSize(pair: string): number {
  return BUCKET_SIZE[pair] ?? 10;
}

interface Bucket {
  priceMin: number;
  priceMax: number;
  buyUsd: number;
  sellUsd: number;
  totalUsd: number;
  delta: number; // buy - sell
}

function fmtPrice(price: number): string {
  return price >= 1000
    ? price.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : price.toFixed(2);
}

function fmtK(usd: number): string {
  if (usd >= 1_000_000) return `${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `${(usd / 1_000).toFixed(0)}K`;
  return `${usd.toFixed(0)}`;
}

interface Props {
  pair: Pair;
  maxBuckets?: number;
}

export function ClusterChart({ pair, maxBuckets = 15 }: Props) {
  const feed = useTradeFeedStore((s) => s.feeds[pair as "BTC" | "ETH"]);

  const { buckets, poc, maxTotal } = useMemo(() => {
    const trades = feed?.buffer.items ?? [];
    if (!trades.length) return { buckets: [], poc: null, maxTotal: 1 };

    const bucketSize = getBucketSize(pair);
    const map = new Map<number, Bucket>();

    for (const trade of trades) {
      const key = Math.floor(trade.price / bucketSize) * bucketSize;
      let b = map.get(key);
      if (!b) {
        b = { priceMin: key, priceMax: key + bucketSize, buyUsd: 0, sellUsd: 0, totalUsd: 0, delta: 0 };
        map.set(key, b);
      }
      if (trade.side === "buy") b.buyUsd += trade.notionalUsd;
      else b.sellUsd += trade.notionalUsd;
      b.totalUsd += trade.notionalUsd;
      b.delta = b.buyUsd - b.sellUsd;
    }

    const sorted = [...map.values()]
      .sort((a, b) => b.priceMin - a.priceMin) // desc price
      .slice(0, maxBuckets);

    const poc = sorted.reduce((best, b) => (b.totalUsd > (best?.totalUsd ?? 0) ? b : best), null as Bucket | null);
    const maxT = sorted.reduce((m, b) => Math.max(m, b.totalUsd), 1);

    return { buckets: sorted, poc, maxTotal: maxT };
  }, [feed, pair, maxBuckets]);

  if (!FEED_PAIRS.has(pair)) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-4">
        <span className="font-mono text-xs text-text-t3">
          Cluster verisi sadece BTC ve ETH için mevcut
        </span>
      </div>
    );
  }

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
            POC: {fmtPrice(poc.priceMin)}–{fmtPrice(poc.priceMax)}
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
          const buyPct = (b.buyUsd / maxTotal) * 100;
          const sellPct = (b.sellUsd / maxTotal) * 100;
          const isPoc = poc !== null && b.priceMin === poc.priceMin;
          const deltaPct = b.totalUsd > 0 ? (b.delta / b.totalUsd) * 100 : 0;

          return (
            <div
              key={b.priceMin}
              className={`relative grid grid-cols-[80px_1fr_1fr_60px] gap-1 px-2 py-0.5 items-center ${
                isPoc ? "bg-yellow-500/5 border-l-2 border-yellow-500" : ""
              }`}
            >
              {/* Price range */}
              <span className={`font-mono text-2xs tabular-nums ${isPoc ? "text-yellow-400 font-bold" : "text-text-t3"}`}>
                {fmtPrice(b.priceMin)}
                {isPoc && " ★"}
              </span>

              {/* Buy bar */}
              <div className="flex items-center gap-1">
                <div className="flex-1 h-3 bg-surface-s2 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-green-500/70 transition-all duration-300"
                    style={{ width: `${buyPct}%` }}
                  />
                </div>
                <span className="font-mono text-2xs text-text-t4 w-10 text-right">{fmtK(b.buyUsd)}</span>
              </div>

              {/* Sell bar */}
              <div className="flex items-center gap-1">
                <div className="flex-1 h-3 bg-surface-s2 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-red-500/70 transition-all duration-300"
                    style={{ width: `${sellPct}%` }}
                  />
                </div>
                <span className="font-mono text-2xs text-text-t4 w-10 text-right">{fmtK(b.sellUsd)}</span>
              </div>

              {/* Delta */}
              <span
                className={`font-mono text-2xs tabular-nums text-right ${
                  deltaPct > 10 ? "text-green-400" : deltaPct < -10 ? "text-red-400" : "text-text-t4"
                }`}
              >
                {deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
