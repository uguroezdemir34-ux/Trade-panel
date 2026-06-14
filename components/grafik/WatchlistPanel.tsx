"use client";

/**
 * WATCHLIST PANEL — TradingView-style izleme listesi (grafik sayfası sağ panel).
 *
 * Düzen:
 *   1. Makro dominance bloğu: BTC.D / ETH.D / USDT.D
 *   2. 15 coin — 4 kolon grid: Sembol | Son | Değ | Değ%
 *
 * Mobil: sağdan kayan drawer (floating "Liste" butonuyla açılır).
 * Masaüstü: sabit sağ sütun (w-[224px]).
 */

import { useState } from "react";
import { useMacroStore } from "@/lib/store/macroStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

interface Props {
  activePair: Pair;
  onPairChange: (pair: Pair) => void;
}

function chgColor(v: number | undefined | null): string {
  if (v == null) return "text-text-t4";
  if (v > 0) return "text-signal-green";
  if (v < 0) return "text-signal-red";
  return "text-text-t3";
}

function fmtPct(chg: number | undefined | null): string {
  if (chg == null) return "—";
  return `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`;
}

function fmtPrice(p: number): string {
  if (p <= 0) return "—";
  if (p < 0.0001) return p.toFixed(8);
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  if (p < 100) return p.toFixed(3);
  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtAbs(abs: number, last: number): string {
  if (last <= 0) return "—";
  const sign = abs >= 0 ? "+" : "";
  const a = Math.abs(abs);
  let s: string;
  if (last < 0.0001) s = a.toFixed(8);
  else if (last < 0.01) s = a.toFixed(6);
  else if (last < 1) s = a.toFixed(4);
  else if (last < 100) s = a.toFixed(3);
  else if (a >= 1000) s = a.toLocaleString("en-US", { maximumFractionDigits: 0 });
  else s = a.toFixed(2);
  return `${sign}${s}`;
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

/** Ortak içerik (masaüstü panel + mobil drawer) */
function WatchlistContent({ activePair, onPairChange }: Props) {
  const btcD = useMacroStore((s) => s.btcD);
  const ethD = useMacroStore((s) => s.ethD);
  const usdtD = useMacroStore((s) => s.usdtD);
  const btcDChange24h = useMacroStore((s) => s.btcDChange24h);
  const ethDChange24h = useMacroStore((s) => s.ethDChange24h);
  const prices = useMarketStore((s) => s.prices);

  return (
    <>
      {/* ── Dominance bloğu ── */}
      <div className="px-2 pt-2 pb-1.5 border-b border-border/50">
        <p className="text-text-t4 font-mono text-[9px] uppercase tracking-widest mb-1.5">Dominance</p>
        <div className="flex flex-col gap-0.5">
          {([
            { label: "BTC.D", val: btcD, chg: btcDChange24h },
            { label: "ETH.D", val: ethD, chg: ethDChange24h },
            { label: "USDT.D", val: usdtD, chg: null },
          ] as const).map(({ label, val, chg }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-text-t3 font-mono text-[10px]">{label}</span>
              <div className="flex items-center gap-1">
                {chg !== null && chg !== undefined && (
                  <span className={`font-mono text-[9px] ${domChgColor(chg)}`}>
                    {chg >= 0 ? "+" : ""}{chg.toFixed(1)}
                  </span>
                )}
                <span className="text-text-t2 font-mono text-[10px] font-medium tabular-nums">
                  {fmtDom(val)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Başlık satırı ── */}
      <div className="grid grid-cols-[1fr_54px_52px_42px] gap-x-1 px-2 py-1 border-b border-border/50 shrink-0">
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider">Sembol</span>
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider text-right">Son</span>
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider text-right">Değ</span>
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider text-right">%</span>
      </div>

      {/* ── Coin listesi ── */}
      <div className="flex flex-col overflow-y-auto flex-1">
        {PAIRS.map((pair) => {
          const tick = prices[pair];
          const last = tick?.last ?? 0;
          const open24h = tick?.open24h ?? 0;
          const abs = open24h > 0 ? last - open24h : 0;
          const chg = tick?.chg;
          const isActive = pair === activePair;
          return (
            <button
              key={pair}
              onClick={() => onPairChange(pair)}
              className={`grid grid-cols-[1fr_54px_52px_42px] gap-x-1 items-center px-2 py-1.5 text-left transition-colors border-l-2 ${
                isActive
                  ? "bg-brand/10 border-l-brand"
                  : "hover:bg-bg-hover border-l-transparent"
              }`}
            >
              <span
                className={`font-mono text-[10px] font-semibold truncate ${
                  isActive ? "text-brand" : "text-text-t2"
                }`}
              >
                {pair}
              </span>
              <span className="font-mono text-[9px] tabular-nums text-right text-text-t2">
                {last > 0 ? fmtPrice(last) : "—"}
              </span>
              <span
                className={`font-mono text-[9px] tabular-nums text-right ${
                  chgColor(open24h > 0 ? abs : null)
                }`}
              >
                {open24h > 0 ? fmtAbs(abs, last) : "—"}
              </span>
              <span className={`font-mono text-[9px] tabular-nums text-right ${chgColor(chg)}`}>
                {fmtPct(chg)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function WatchlistPanel({ activePair, onPairChange }: Props): React.ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleDrawerPairChange = (pair: Pair) => {
    onPairChange(pair);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* ── Masaüstü panel (md+) ── */}
      <div className="hidden md:flex flex-col border border-border bg-bg-card rounded-lg overflow-hidden select-none w-[224px] shrink-0">
        <WatchlistContent activePair={activePair} onPairChange={onPairChange} />
      </div>

      {/* ── Mobil: floating buton ── */}
      <button
        className="md:hidden fixed bottom-20 right-3 z-30 rounded-full bg-bg-card border border-border shadow-lg px-3 py-2 font-mono text-xs text-text-t2 active:bg-bg-hover"
        onClick={() => setDrawerOpen(true)}
        aria-label="İzleme listesi"
      >
        ☰ Liste
      </button>

      {/* ── Mobil: drawer ── */}
      {drawerOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="md:hidden fixed inset-y-0 right-0 z-50 w-[85vw] max-w-[300px] flex flex-col bg-bg-card border-l border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
              <span className="font-mono text-xs text-text-t2 font-semibold uppercase tracking-wider">
                İzleme Listesi
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded px-2 py-0.5 font-mono text-xs text-text-t4 hover:text-text-t1 hover:bg-bg-hover transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              <WatchlistContent
                activePair={activePair}
                onPairChange={handleDrawerPairChange}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
