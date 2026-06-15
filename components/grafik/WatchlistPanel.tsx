"use client";

/**
 * WATCHLIST PANEL — TradingView-style izleme listesi (grafik sayfası sağ panel).
 *
 * Düzen:
 *   1. Makro dominance bloğu: BTC.D / ETH.D / USDT.D  (sticky, kaymaz)
 *   2. Başlık satırı: Sembol | Son | Değ | %            (sticky, kaymaz)
 *   3. 15 coin listesi                                   (overflow-y-auto scroll)
 *
 * Mobil: sağdan kayan drawer (floating "Liste" butonuyla açılır).
 * Masaüstü: sticky sağ sütun, max-h ile coin listesi kendi içinde kayar.
 */

import { useState } from "react";
import { useMacroStore } from "@/lib/store/macroStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useScoreStore } from "@/lib/store/scoreStore";
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
  // Very small coins (SHIB range): exponential keeps it to 7 chars max
  if (p < 0.00001) return p.toExponential(2);  // "4.91e-6"
  if (p < 0.01)    return p.toFixed(6);         // "0.000014" (8 chars)
  if (p < 1)       return p.toFixed(4);
  if (p < 100)     return p.toFixed(3);
  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtAbs(abs: number, last: number): string {
  if (last <= 0) return "—";
  const sign = abs >= 0 ? "+" : "";
  const a = Math.abs(abs);
  let s: string;
  // Tiny abs change → exponential for compactness
  if (a < 0.00001)      s = a.toExponential(2);  // "4.91e-8" → "+4.91e-8" (8 chars)
  else if (last < 0.01) s = a.toFixed(6);         // "+0.000012" (9 chars, fits 56px col)
  else if (last < 1)    s = a.toFixed(4);
  else if (last < 100)  s = a.toFixed(3);
  else if (a >= 1000)   s = a.toLocaleString("en-US", { maximumFractionDigits: 0 });
  else                  s = a.toFixed(2);
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

// Grid column template — shared between header and data rows
const GRID_COLS = "grid-cols-[1fr_56px_46px_40px_28px]";

/** Ortak içerik (masaüstü panel + mobil drawer) */
function WatchlistContent({ activePair, onPairChange }: Props) {
  const btcD         = useMacroStore((s) => s.btcD);
  const ethD         = useMacroStore((s) => s.ethD);
  const usdtD        = useMacroStore((s) => s.usdtD);
  const btcDChange24h = useMacroStore((s) => s.btcDChange24h);
  const ethDChange24h = useMacroStore((s) => s.ethDChange24h);
  const prices       = useMarketStore((s) => s.prices);
  const allScores    = useScoreStore((s) => s.results);

  return (
    <>
      {/* ── Dominance bloğu (sabit) ── */}
      <div className="shrink-0 px-2 pt-2 pb-1.5 border-b border-border/50">
        <p className="text-text-t4 font-mono text-[9px] uppercase tracking-widest mb-1.5">Dominance</p>
        <div className="flex flex-col gap-0.5">
          {([
            { label: "BTC.D",  val: btcD,  chg: btcDChange24h },
            { label: "ETH.D",  val: ethD,  chg: ethDChange24h },
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

      {/* ── Başlık satırı (sabit) ── */}
      <div className={`shrink-0 grid ${GRID_COLS} gap-x-1 px-2 py-1 border-b border-border/50`}>
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider">Sembol</span>
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider text-right">Son</span>
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider text-right">Değ</span>
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider text-right">%</span>
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider text-right">QX</span>
      </div>

      {/* ── Coin listesi (kaydırılabilir) ── */}
      <div
        className={[
          "flex flex-col overflow-y-auto flex-1",
          // İnce, sönük scrollbar
          "[&::-webkit-scrollbar]:w-[3px]",
          "[&::-webkit-scrollbar-thumb]:rounded-full",
          "[&::-webkit-scrollbar-thumb]:bg-border/60",
          "[&::-webkit-scrollbar-track]:bg-transparent",
        ].join(" ")}
      >
        {PAIRS.map((pair) => {
          const tick    = prices[pair];
          const last    = tick?.last    ?? 0;
          const open24h = tick?.open24h ?? 0;
          const abs     = open24h > 0 ? last - open24h : 0;
          const chg     = tick?.chg;
          const isActive = pair === activePair;
          return (
            <button
              key={pair}
              onClick={() => onPairChange(pair)}
              className={`grid ${GRID_COLS} gap-x-1 items-center px-2 py-1.5 text-left transition-colors border-l-2 ${
                isActive
                  ? "bg-brand/10 border-l-brand"
                  : "hover:bg-bg-hover border-l-transparent"
              }`}
            >
              {/* Sembol */}
              <span
                className={`font-mono text-[10px] font-semibold truncate ${
                  isActive ? "text-brand" : "text-text-t2"
                }`}
              >
                {pair}
              </span>
              {/* Son fiyat */}
              <span className="font-mono text-[9px] tabular-nums whitespace-nowrap text-right text-text-t2">
                {last > 0 ? fmtPrice(last) : "—"}
              </span>
              {/* Değ (mutlak) */}
              <span
                className={`font-mono text-[9px] tabular-nums whitespace-nowrap text-right ${
                  chgColor(open24h > 0 ? abs : null)
                }`}
              >
                {open24h > 0 ? fmtAbs(abs, last) : "—"}
              </span>
              {/* Değ% */}
              <span
                className={`font-mono text-[9px] tabular-nums whitespace-nowrap text-right ${chgColor(chg)}`}
              >
                {fmtPct(chg)}
              </span>
              {/* QX Score */}
              {(() => {
                const sc = allScores[pair]?.score;
                if (sc == null) {
                  return <span className="font-mono text-[9px] text-text-t4 text-right">—</span>;
                }
                const bgCls = sc >= 70
                  ? "bg-green-500/25 border-green-500/40 text-green-200"
                  : sc >= 40
                  ? "bg-amber-500/25 border-amber-500/40 text-amber-200"
                  : "bg-red-500/25 border-red-500/40 text-red-200";
                return (
                  <span className={`inline-flex items-center justify-center w-7 h-5 rounded border font-mono text-[10px] font-bold tabular-nums ${bgCls}`}>
                    {sc}
                  </span>
                );
              })()}
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
      {/*
        self-start + sticky: panel sayfayla birlikte kaymaz, viewport üstünde sabit durur.
        max-h: yükseklik sınırı → flex-1 coin listesi bu sınırda scroll eder.
      */}
      <div
        className={[
          "hidden md:flex flex-col",
          "border border-border bg-bg-card rounded-lg overflow-hidden",
          "select-none w-[258px] shrink-0",
        ].join(" ")}
      >
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
