"use client";

/**
 * DEPTH CHART (DOM) — Bid/ask derinlik görselleştirmesi.
 *
 * Layout: asks üstte (en kötü → en iyi), bids altta (en iyi → en kötü).
 * Bar genişliği: notionalUsd / maxNotional × 100%.
 * Wall: 3× ortalama üstü seviye — sarı ⚡ ile işaretli.
 */

import { useMemo } from "react";
import type { OrderBookSnapshot } from "@/lib/orderflow/orderbook";
import { computeOrderBookImbalance } from "@/lib/orderflow/orderbook";
import { detectWalls } from "@/lib/orderflow/wallDetect";

interface Props {
  snapshot: OrderBookSnapshot | null;
  maxLevels?: number;
}

function fmtK(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}

function fmtPrice(price: number): string {
  return price >= 1000 ? price.toLocaleString("en-US", { maximumFractionDigits: 1 }) : price.toFixed(4);
}

function fmtQty(qty: number): string {
  return qty < 0.001 ? qty.toFixed(5) : qty < 10 ? qty.toFixed(3) : qty.toFixed(1);
}

interface LevelRowProps {
  price: number;
  qty: number;
  notional: number;
  barPct: number;
  side: "bid" | "ask";
  isWall: boolean;
}

function LevelRow({ price, qty, notional, barPct, side, isWall }: LevelRowProps) {
  const barColor = side === "bid" ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)";
  const wallColor = side === "bid" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)";
  const textColor = side === "bid" ? "text-green-400" : "text-red-400";

  return (
    <div className="relative flex items-center h-5 px-2 gap-2 hover:bg-surface-s1 transition-colors">
      {/* Background bar */}
      <div
        className="absolute inset-y-0 left-0 transition-all duration-300"
        style={{ width: `${barPct}%`, backgroundColor: isWall ? wallColor : barColor }}
      />
      {/* Price */}
      <span className={`relative z-10 w-24 font-mono text-2xs tabular-nums ${textColor} ${isWall ? "font-bold" : ""}`}>
        {fmtPrice(price)}
      </span>
      {/* Qty */}
      <span className="relative z-10 w-16 font-mono text-2xs tabular-nums text-text-t2 text-right">
        {fmtQty(qty)}
      </span>
      {/* Notional */}
      <span className="relative z-10 w-14 font-mono text-2xs tabular-nums text-text-t4 text-right">
        {fmtK(notional)}
      </span>
      {/* Wall badge */}
      {isWall && (
        <span className="relative z-10 ml-auto text-yellow-400 text-2xs">⚡</span>
      )}
    </div>
  );
}

export function DepthChart({ snapshot, maxLevels = 10 }: Props) {
  const { walls, imbalance, spread, asks, bids, maxNotional } = useMemo(() => {
    if (!snapshot) return { walls: new Set<number>(), imbalance: null, spread: null, asks: [], bids: [], maxNotional: 1 };

    const { walls: wallList } = detectWalls(snapshot, 3.0);
    const wallSet = new Set(wallList.map((w) => w.price));
    const imb = computeOrderBookImbalance(snapshot, maxLevels);

    const bestAsk = snapshot.asks[0]?.price ?? 0;
    const bestBid = snapshot.bids[0]?.price ?? 0;
    const spread = bestAsk && bestBid ? bestAsk - bestBid : null;

    const slicedAsks = snapshot.asks.slice(0, maxLevels);
    const slicedBids = snapshot.bids.slice(0, maxLevels);
    const maxN = Math.max(
      ...slicedAsks.map((a) => a.notionalUsd),
      ...slicedBids.map((b) => b.notionalUsd),
      1,
    );

    return {
      walls: wallSet,
      imbalance: imb,
      spread,
      asks: slicedAsks.slice().reverse(), // worst at top, best at bottom
      bids: slicedBids,
      maxNotional: maxN,
    };
  }, [snapshot, maxLevels]);

  if (!snapshot) {
    return (
      <div className="flex items-center justify-center h-48 text-text-t4 font-mono text-2xs">
        Yükleniyor…
      </div>
    );
  }

  const bidPct = imbalance
    ? Math.round((imbalance.bidNotionalUsd / (imbalance.bidNotionalUsd + imbalance.askNotionalUsd)) * 100)
    : 50;
  const askPct = 100 - bidPct;

  return (
    <div className="flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border">
        <span className="font-mono text-2xs text-text-t4">
          SPREAD {spread !== null ? `$${spread < 1 ? spread.toFixed(4) : spread.toFixed(2)}` : "—"}
        </span>
        {imbalance && (
          <div className="flex items-center gap-1">
            <span className="font-mono text-2xs text-green-400">{bidPct}% BID</span>
            <div className="w-20 h-1.5 rounded bg-surface-s1 overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${bidPct}%` }}
              />
            </div>
            <span className="font-mono text-2xs text-red-400">{askPct}% ASK</span>
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="flex items-center px-2 py-0.5 bg-surface-s1">
        <span className="w-24 font-mono text-2xs text-text-t4">PRICE</span>
        <span className="w-16 font-mono text-2xs text-text-t4 text-right">QTY</span>
        <span className="w-14 font-mono text-2xs text-text-t4 text-right">NOTIONAL</span>
      </div>

      {/* ASK levels (worst at top → best at bottom) */}
      <div className="border-b border-dashed border-border/60">
        {asks.map((ask) => (
          <LevelRow
            key={ask.price}
            price={ask.price}
            qty={ask.qty}
            notional={ask.notionalUsd}
            barPct={(ask.notionalUsd / maxNotional) * 100}
            side="ask"
            isWall={walls.has(ask.price)}
          />
        ))}
      </div>

      {/* Mid label */}
      <div className="flex items-center justify-center py-0.5 bg-surface-s1">
        <span className="font-mono text-2xs text-text-t3 tracking-wider">
          {imbalance?.direction === "bid_dominated" ? "↑ BID DOMINANT" :
           imbalance?.direction === "ask_dominated" ? "↓ ASK DOMINANT" : "BALANCED"}
        </span>
      </div>

      {/* BID levels (best at top → worst at bottom) */}
      {bids.map((bid) => (
        <LevelRow
          key={bid.price}
          price={bid.price}
          qty={bid.qty}
          notional={bid.notionalUsd}
          barPct={(bid.notionalUsd / maxNotional) * 100}
          side="bid"
          isWall={walls.has(bid.price)}
        />
      ))}

      {/* Wall summary */}
      {walls.size > 0 && (
        <div className="flex flex-wrap gap-1 px-2 py-1 border-t border-border/40">
          {[...walls].slice(0, 4).map((price) => {
            const ask = snapshot.asks.find((a) => a.price === price);
            const bid = snapshot.bids.find((b) => b.price === price);
            const side = ask ? "ask" : "bid";
            const notional = (ask ?? bid)?.notionalUsd ?? 0;
            return (
              <span
                key={price}
                className={`font-mono text-2xs px-1.5 py-0.5 rounded border ${
                  side === "ask" ? "border-red-500/30 text-red-400" : "border-green-500/30 text-green-400"
                }`}
              >
                ⚡ {side === "ask" ? "ASK" : "BID"} {fmtPrice(price)} {fmtK(notional)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
