"use client";

/**
 * WATCHLIST PANEL — TradingView-style right-side panel for grafik page.
 *
 * Shows:
 *   1. Macro dominance block: BTC.D / ETH.D / USDT.D
 *   2. 15-coin list: live price + 24h chg%, active pair highlighted
 *
 * Data sources (all pre-fetched by AppShell hooks, no new requests):
 *   - marketStore.prices[pair] → last price + chg
 *   - macroStore.btcD / ethD / usdtD
 */

import { useMacroStore } from "@/lib/store/macroStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

interface Props {
  activePair: Pair;
  onPairChange: (pair: Pair) => void;
}

function chgColor(chg: number | undefined): string {
  if (chg === undefined || chg === null) return "text-text-t4";
  if (chg > 0) return "text-signal-green";
  if (chg < 0) return "text-signal-red";
  return "text-text-t3";
}

function fmtChg(chg: number | undefined | null): string {
  if (chg === undefined || chg === null) return "—";
  const sign = chg >= 0 ? "+" : "";
  return `${sign}${chg.toFixed(2)}%`;
}

function fmtPrice(p: number): string {
  if (p <= 0) return "—";
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  if (p < 100) return p.toFixed(3);
  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtDom(v: number | null): string {
  if (v === null || v <= 0) return "—";
  return `${v.toFixed(1)}%`;
}

function domChgColor(v: number | null): string {
  if (v === null) return "text-text-t4";
  if (v > 0) return "text-signal-green";
  if (v < 0) return "text-signal-red";
  return "text-text-t4";
}

export function WatchlistPanel({ activePair, onPairChange }: Props): React.ReactElement {
  const btcD = useMacroStore((s) => s.btcD);
  const ethD = useMacroStore((s) => s.ethD);
  const usdtD = useMacroStore((s) => s.usdtD);
  const btcDChange24h = useMacroStore((s) => s.btcDChange24h);
  const ethDChange24h = useMacroStore((s) => s.ethDChange24h);
  const prices = useMarketStore((s) => s.prices);

  return (
    <div className="flex flex-col gap-0 border-border bg-bg-card rounded-lg border overflow-hidden select-none w-[148px] shrink-0">
      {/* ── Dominance block ── */}
      <div className="px-2 pt-2 pb-1.5 border-b border-border/50">
        <p className="text-text-t4 font-mono text-[9px] uppercase tracking-widest mb-1.5">Dominance</p>
        <div className="flex flex-col gap-0.5">
          {/* BTC.D */}
          <div className="flex items-center justify-between">
            <span className="text-text-t3 font-mono text-[10px]">BTC.D</span>
            <div className="flex items-center gap-1">
              {btcDChange24h !== null && (
                <span className={`font-mono text-[9px] ${domChgColor(btcDChange24h)}`}>
                  {btcDChange24h >= 0 ? "+" : ""}{btcDChange24h.toFixed(1)}
                </span>
              )}
              <span className="text-text-t2 font-mono text-[10px] font-medium tabular-nums">
                {fmtDom(btcD)}
              </span>
            </div>
          </div>
          {/* ETH.D */}
          <div className="flex items-center justify-between">
            <span className="text-text-t3 font-mono text-[10px]">ETH.D</span>
            <div className="flex items-center gap-1">
              {ethDChange24h !== null && (
                <span className={`font-mono text-[9px] ${domChgColor(ethDChange24h)}`}>
                  {ethDChange24h >= 0 ? "+" : ""}{ethDChange24h.toFixed(1)}
                </span>
              )}
              <span className="text-text-t2 font-mono text-[10px] font-medium tabular-nums">
                {fmtDom(ethD)}
              </span>
            </div>
          </div>
          {/* USDT.D */}
          <div className="flex items-center justify-between">
            <span className="text-text-t3 font-mono text-[10px]">USDT.D</span>
            <span className="text-text-t2 font-mono text-[10px] font-medium tabular-nums">
              {fmtDom(usdtD)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Coin list ── */}
      <div className="flex flex-col divide-y divide-border/30 overflow-y-auto flex-1">
        {PAIRS.map((pair) => {
          const tick = prices[pair];
          const isActive = pair === activePair;
          return (
            <button
              key={pair}
              onClick={() => onPairChange(pair)}
              className={`flex flex-col px-2 py-1 text-left transition-colors ${
                isActive
                  ? "bg-brand/10 border-l-2 border-l-brand"
                  : "hover:bg-bg-hover border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`font-mono text-[10px] font-semibold ${
                    isActive ? "text-brand" : "text-text-t2"
                  }`}
                >
                  {pair}
                </span>
                <span
                  className={`font-mono text-[9px] tabular-nums ${chgColor(tick?.chg)}`}
                >
                  {fmtChg(tick?.chg)}
                </span>
              </div>
              <span className="text-text-t3 font-mono text-[9px] tabular-nums">
                {tick?.last ? fmtPrice(tick.last) : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
