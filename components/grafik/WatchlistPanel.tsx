"use client";

import { useState } from "react";
import { useMacroStore } from "@/lib/store/macroStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useScoreStore } from "@/lib/store/scoreStore";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

interface Props {
  activePair: Pair;
  onPairChange: (pair: Pair) => void;
}

/* ── Helpers ── */
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
  if (p < 0.00001) return p.toExponential(2);
  if (p < 0.01)    return p.toFixed(6);
  if (p < 1)       return p.toFixed(4);
  if (p < 100)     return p.toFixed(3);
  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtAbs(abs: number, last: number): string {
  if (last <= 0) return "—";
  const sign = abs >= 0 ? "+" : "";
  const a = Math.abs(abs);
  let s: string;
  if (a < 0.00001)      s = a.toExponential(2);
  else if (last < 0.01) s = a.toFixed(6);
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

const GRID_COLS = "grid-cols-[1fr_56px_46px_40px_36px]";

const REGIME_LABELS: Record<string, string> = {
  trending_strong: "Güçlü Trend",
  trending_weak:   "Zayıf Trend",
  ranging_meanrev: "Yatay/MR",
  ranging:         "Yatay",
  transitioning:   "Geçiş",
  mixed:           "Karışık",
  unknown:         "—",
};

/* ── Detail Card ── */
function PairDetailCard({ activePair }: { activePair: Pair }) {
  const prices    = useMarketStore((s) => s.prices);
  const allScores = useScoreStore((s) => s.results);

  const tick       = prices[activePair];
  const last       = tick?.last  ?? 0;
  const chg        = tick?.chg   ?? null;
  const result     = allScores[activePair];
  const sc         = result?.score      ?? null;
  const direction  = result?.direction  ?? null;
  const verdict    = result?.verdict    ?? null;
  const regime     = result?.regime     ?? null;
  const volBreak   = result?.volBreakoutActive ?? false;
  const volScore   = result?.sub.vol    ?? null;
  const trendScore = result?.sub.trend  ?? null;

  const volLabel   = volScore   == null ? "—" : volScore   >= 18 ? "Güçlü" : volScore   >= 10 ? "Orta" : "Zayıf";
  const volClr     = volScore   == null ? "text-zinc-500" : volScore   >= 18 ? "text-emerald-400" : volScore   >= 10 ? "text-amber-400" : "text-red-400";
  const trendLabel = trendScore == null ? "—" : trendScore >= 17 ? "Güçlü" : trendScore >= 10 ? "Orta" : "Zayıf";
  const trendClr   = trendScore == null ? "text-zinc-500" : trendScore >= 17 ? "text-emerald-400" : trendScore >= 10 ? "text-amber-400" : "text-red-400";

  const scoreBg =
    sc == null   ? "bg-zinc-700"    :
    sc >= 70     ? "bg-emerald-600" :
    sc >= 40     ? "bg-amber-600"   :
                   "bg-red-600";

  const verdictBg =
    verdict === "go"   ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" :
    verdict === "wait" ? "bg-amber-500/20 text-amber-400 border-amber-500/40"       :
    verdict === "no"   ? "bg-red-500/20 text-red-400 border-red-500/40"             :
                         "bg-zinc-800 text-zinc-500 border-zinc-700";

  return (
    <div className="shrink-0 mx-2 mb-2 mt-1 rounded-lg border border-zinc-700 bg-zinc-900/80 p-3">
      {/* Başlık: pair + yön + skor */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[11px] font-bold text-white tracking-wide truncate">
            {activePair}
          </span>
          {direction && direction !== "NEUTRAL" && (
            <span className={`font-mono text-[7px] font-bold px-1 py-0.5 rounded leading-none ${
              direction === "LONG" ? "bg-emerald-500/25 text-emerald-400" : "bg-red-500/25 text-red-400"
            }`}>
              {direction}
            </span>
          )}
        </div>
        <span className={`flex items-center justify-center w-8 h-6 rounded font-mono text-xs font-bold text-white shrink-0 ${scoreBg}`}>
          {sc ?? "—"}
        </span>
      </div>

      {/* Fiyat */}
      <div className="mb-3">
        <div className="font-mono text-[18px] font-bold text-white tabular-nums leading-tight">
          {last > 0 ? fmtPrice(last) : "—"}
        </div>
        <div className={`font-mono text-[11px] tabular-nums font-semibold ${chgColor(chg)}`}>
          {fmtPct(chg)}
        </div>
      </div>

      {/* 2×2 Metrik */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mb-3">
        <div>
          <p className="text-zinc-500 font-mono text-[7.5px] uppercase tracking-widest mb-0.5">Hacim Çarpanı</p>
          <p className={`font-mono text-[10px] font-semibold ${volClr}`}>
            {volLabel}
            {volScore != null && <span className="text-zinc-500 font-normal"> ({volScore})</span>}
          </p>
        </div>
        <div>
          <p className="text-zinc-500 font-mono text-[7.5px] uppercase tracking-widest mb-0.5">Smart Money</p>
          <p className={`font-mono text-[10px] font-semibold ${volBreak ? "text-emerald-400" : "text-zinc-500"}`}>
            {volBreak ? "Aktif ↑" : result == null ? "Hesaplamada" : "—"}
          </p>
        </div>
        <div>
          <p className="text-zinc-500 font-mono text-[7.5px] uppercase tracking-widest mb-0.5">Trend</p>
          <p className={`font-mono text-[10px] font-semibold ${trendClr}`}>
            {trendLabel}
            {trendScore != null && <span className="text-zinc-500 font-normal"> ({trendScore})</span>}
          </p>
        </div>
        <div>
          <p className="text-zinc-500 font-mono text-[7.5px] uppercase tracking-widest mb-0.5">Rejim</p>
          <p className="font-mono text-[10px] font-semibold text-zinc-300">
            {regime ? (REGIME_LABELS[regime] ?? regime) : "—"}
          </p>
        </div>
      </div>

      {/* Verdict */}
      <div className={`rounded border py-1 text-center font-mono text-[9px] font-bold tracking-[0.12em] uppercase ${verdictBg}`}>
        {verdict ? verdict.toUpperCase() : "—"}
      </div>
    </div>
  );
}

/* ── Watchlist İçerik ── */
function WatchlistContent({ activePair, onPairChange }: Props) {
  const btcD          = useMacroStore((s) => s.btcD);
  const ethD          = useMacroStore((s) => s.ethD);
  const usdtD         = useMacroStore((s) => s.usdtD);
  const btcDChange24h = useMacroStore((s) => s.btcDChange24h);
  const ethDChange24h = useMacroStore((s) => s.ethDChange24h);
  const prices        = useMarketStore((s) => s.prices);
  const allScores     = useScoreStore((s) => s.results);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Dominance ── */}
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

      {/* ── Header ── */}
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
          "flex flex-col overflow-y-auto flex-1 min-h-0",
          "[&::-webkit-scrollbar]:w-[3px]",
          "[&::-webkit-scrollbar-thumb]:rounded-full",
          "[&::-webkit-scrollbar-thumb]:bg-border/60",
          "[&::-webkit-scrollbar-track]:bg-transparent",
        ].join(" ")}
      >
        {PAIRS.map((pair) => {
          const tick     = prices[pair];
          const last     = tick?.last    ?? 0;
          const open24h  = tick?.open24h ?? 0;
          const abs      = open24h > 0 ? last - open24h : 0;
          const chg      = tick?.chg;
          const isActive = pair === activePair;
          const sc       = allScores[pair]?.score;

          const scoreBg =
            sc == null ? "" :
            sc >= 70   ? "bg-emerald-600" :
            sc >= 40   ? "bg-amber-600"   :
                         "bg-red-600";

          return (
            <button
              key={pair}
              onClick={() => onPairChange(pair)}
              className={`grid ${GRID_COLS} gap-x-1 items-center px-2 py-1.5 text-left transition-colors border-l-2 ${
                isActive ? "bg-brand/10 border-l-brand" : "hover:bg-bg-hover border-l-transparent"
              }`}
            >
              <span className={`font-mono text-[10px] font-semibold truncate ${isActive ? "text-brand" : "text-text-t2"}`}>
                {pair}
              </span>
              <span className="font-mono text-[9px] tabular-nums whitespace-nowrap text-right text-text-t2">
                {last > 0 ? fmtPrice(last) : "—"}
              </span>
              <span className={`font-mono text-[9px] tabular-nums whitespace-nowrap text-right ${chgColor(open24h > 0 ? abs : null)}`}>
                {open24h > 0 ? fmtAbs(abs, last) : "—"}
              </span>
              <span className={`font-mono text-[9px] tabular-nums whitespace-nowrap text-right ${chgColor(chg)}`}>
                {fmtPct(chg)}
              </span>
              {/* QX Score rozeti */}
              {sc == null ? (
                <span className="font-mono text-[9px] text-text-t4 text-right">—</span>
              ) : (
                <span className={`flex items-center justify-center w-8 h-6 rounded font-mono text-xs font-bold text-white tabular-nums ${scoreBg}`}>
                  {sc}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Seçili pair detay kartı ── */}
      <PairDetailCard activePair={activePair} />
    </div>
  );
}

/* ── WatchlistPanel (export) ── */
export function WatchlistPanel({ activePair, onPairChange }: Props): React.ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleDrawerPairChange = (pair: Pair) => {
    onPairChange(pair);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* ── Masaüstü panel ── */}
      <div className="hidden md:flex flex-col border border-border bg-bg-card rounded-lg overflow-hidden select-none w-[266px] shrink-0 self-stretch">
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
          <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setDrawerOpen(false)} />
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
            <div className="flex-1 overflow-hidden">
              <WatchlistContent activePair={activePair} onPairChange={handleDrawerPairChange} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
