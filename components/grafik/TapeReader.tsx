"use client";

/**
 * TAPE READER — Time & Sales (gerçekleşen işlemler akışı).
 *
 * Veri kaynağı: tradeFeedStore (canlı OKX WS trade feed).
 * ÖNEMLİ KISIT: Sadece BTC ve ETH desteklenir — trade feed bu iki çiftle sınırlı.
 * Diğer çiftler için bilgi mesajı gösterilir.
 *
 * Büyük işlem eşiği:
 *   BTC: notional > $100K
 *   ETH: notional > $30K
 *   Diğer: notional > $50K
 */

import { useMemo } from "react";
import { useTradeFeedStore } from "@/lib/store/tradeFeedStore";
import type { Pair } from "@/lib/constants/pairs";
import type { Trade } from "@/lib/orderflow/types";
import { useT } from "@/lib/i18n/context";

const FEED_PAIRS = new Set<string>(["BTC", "ETH"]);

const WHALE_THRESHOLD: Record<string, number> = {
  BTC: 100_000,
  ETH: 30_000,
};

function getWhaleThreshold(pair: string): number {
  return WHALE_THRESHOLD[pair] ?? 50_000;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function fmtPrice(price: number): string {
  return price >= 1000
    ? price.toLocaleString("en-US", { maximumFractionDigits: 1 })
    : price.toFixed(4);
}

function fmtQty(qty: number, pair: string): string {
  if (pair === "BTC") return qty < 0.01 ? qty.toFixed(4) : qty.toFixed(3);
  return qty < 0.1 ? qty.toFixed(3) : qty.toFixed(2);
}

function fmtK(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

interface TradeRowProps {
  trade: Trade;
  isWhale: boolean;
}

function TradeRow({ trade, isWhale }: TradeRowProps) {
  const isBuy = trade.side === "buy";
  return (
    <div
      className={`flex items-center gap-2 px-2 py-0.5 font-mono text-2xs tabular-nums transition-colors ${
        isWhale
          ? isBuy
            ? "bg-green-500/10 border-l-2 border-green-500"
            : "bg-red-500/10 border-l-2 border-red-500"
          : ""
      }`}
    >
      <span className="text-text-t4 w-16 shrink-0">{fmtTime(trade.timestamp)}</span>
      <span className={`w-8 shrink-0 font-bold ${isBuy ? "text-green-400" : "text-red-400"}`}>
        {isBuy ? "BUY" : "SEL"}
      </span>
      <span className="w-24 shrink-0 text-text-t1">{fmtPrice(trade.price)}</span>
      <span className="w-16 shrink-0 text-text-t2 text-right">{fmtQty(trade.size, trade.pair)}</span>
      <span className="text-text-t3 text-right flex-1">{fmtK(trade.notionalUsd)}</span>
      {isWhale && <span className="text-yellow-400 shrink-0">🐋</span>}
    </div>
  );
}

interface Props {
  pair: Pair;
  maxRows?: number;
}

export function TapeReader({ pair, maxRows = 60 }: Props) {
  const t = useT();
  // tradeFeedStore.getTrades is not reactive — use feeds selector
  const feed = useTradeFeedStore((s) => s.feeds[pair as "BTC" | "ETH"]);

  const recentTrades: readonly Trade[] = useMemo(() => {
    if (!feed) return [];
    return feed.buffer.items.slice(-maxRows).reverse();
  }, [feed, maxRows]);

  if (!FEED_PAIRS.has(pair)) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-4">
        <span className="font-mono text-xs text-text-t3">
          Trade feed sadece BTC ve ETH için aktif
        </span>
        <span className="font-mono text-2xs text-text-t4">
          {pair} için tape verisi mevcut değil
        </span>
      </div>
    );
  }

  const whaleThreshold = getWhaleThreshold(pair);

  if (!recentTrades.length) {
    return (
      <div className="flex items-center justify-center h-48 text-text-t4 font-mono text-2xs">
        Veri bekleniyor…
      </div>
    );
  }

  const buyCount = recentTrades.filter((t) => t.side === "buy").length;
  const sellCount = recentTrades.length - buyCount;
  const buyPct = Math.round((buyCount / recentTrades.length) * 100);

  return (
    <div className="flex flex-col">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-2 py-1 border-b border-border bg-surface-s1">
        <span className="font-mono text-2xs text-green-400">BUY {buyPct}%</span>
        <div className="flex-1 h-1.5 rounded bg-surface-s2 overflow-hidden">
          <div className="h-full bg-green-500" style={{ width: `${buyPct}%` }} />
        </div>
        <span className="font-mono text-2xs text-red-400">SEL {100 - buyPct}%</span>
        <span className="font-mono text-2xs text-text-t4 ml-2">{t("common.tradeCount", { n: recentTrades.length })}</span>
        <span className="font-mono text-2xs text-text-t4">
          🐋 &gt;{whaleThreshold >= 1000 ? `$${whaleThreshold / 1000}K` : `$${whaleThreshold}`}
        </span>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-2 py-0.5 bg-surface-s1 border-b border-border">
        <span className="w-16 font-mono text-2xs text-text-t4">TIME</span>
        <span className="w-8 font-mono text-2xs text-text-t4">SIDE</span>
        <span className="w-24 font-mono text-2xs text-text-t4">PRICE</span>
        <span className="w-16 font-mono text-2xs text-text-t4 text-right">QTY</span>
        <span className="flex-1 font-mono text-2xs text-text-t4 text-right">NOTIONAL</span>
      </div>

      {/* Trade rows */}
      <div className="overflow-y-auto max-h-64">
        {recentTrades.map((trade, i) => (
          <TradeRow
            key={`${trade.tradeId}_${i}`}
            trade={trade}
            isWhale={trade.notionalUsd >= whaleThreshold}
          />
        ))}
      </div>

      {/* Buy vs Sell count */}
      <div className="flex justify-between px-2 py-0.5 border-t border-border/40 font-mono text-2xs">
        <span className="text-green-400">▲ {buyCount} BUY</span>
        <span className="text-red-400">▼ {sellCount} SELL</span>
      </div>
    </div>
  );
}
