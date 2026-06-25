"use client";

import { useMemo, useState, useEffect } from "react";
import { useMacroStore } from "@/lib/store/macroStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useCandleStore } from "@/lib/store/candleStore";
import { useTradeFeedStore, selectTrades } from "@/lib/store/tradeFeedStore";
import { useWatchlistStore } from "@/lib/store/watchlistStore";
import { computeCvdMultiFrame } from "@/lib/orderflow/cvd";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import { useT } from "@/lib/i18n/context";

interface Props {
  activePair: Pair;
  onPairChange: (pair: Pair) => void;
}

/* ── Coin renk paleti ── */
const PAIR_COLORS: Record<string, string> = {
  BTC:   "#f7931a", ETH:  "#627eea", XRP:  "#00aae4", SOL:  "#9945ff",
  BNB:   "#f3ba2f", ADA:  "#0033ad", AVAX: "#e84142", DOT:  "#e6007a",
  LINK:  "#2a5ada", POL:  "#8247e5", DOGE: "#c2a633", SHIB: "#ff4200",
  SUI:   "#4da2ff", NEAR: "#00c08b", TRX:  "#ef0027", APT:  "#4285f4",
  TAO:   "#888888", PENDLE: "#8fbe00", OP:  "#ff0420", WIF:  "#a855f7",
};
function pairColor(p: string): string { return PAIR_COLORS[p] ?? "#6366f1"; }

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

/* ── Coin Picker Modal ── */
function CoinPickerModal({
  watchedPairs,
  onToggle,
  onClose,
}: {
  watchedPairs: Pair[];
  onToggle: (pair: Pair) => void;
  onClose: () => void;
}) {
  const prices = useMarketStore((s) => s.prices);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full md:w-[380px] max-h-[82vh] bg-bg-card rounded-t-2xl md:rounded-xl border border-border flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-mono text-sm font-bold text-text-t1 tracking-wide">
            Coin Seç
          </span>
          <button
            onClick={onClose}
            className="font-mono text-base text-text-t4 hover:text-text-t1 transition-colors leading-none"
          >
            ✕
          </button>
        </div>

        {/* Hint */}
        <div className="shrink-0 px-4 py-2 bg-surface-s1 border-b border-border/40">
          <p className="font-mono text-[10px] text-text-t4">
            {watchedPairs.length} / {PAIRS.length} coin seçili — listeye eklemek/çıkarmak için tıkla
          </p>
        </div>

        {/* Coin listesi */}
        <div className="flex-1 overflow-y-auto">
          {PAIRS.map((pair) => {
            const isWatched = watchedPairs.includes(pair);
            const tick = prices[pair];
            const last = tick?.last ?? 0;
            const chg = tick?.chg;
            const color = pairColor(pair);

            return (
              <button
                key={pair}
                onClick={() => onToggle(pair)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-hover active:bg-bg-hover border-b border-border/30 transition-colors text-left"
              >
                {/* Coin badge */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: color + "28", border: `1.5px solid ${color}55` }}
                >
                  <span style={{ color }}>{pair.slice(0, 3)}</span>
                </div>

                {/* İsim */}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[13px] font-bold text-text-t1 leading-none">{pair}</p>
                  <p className="font-mono text-[10px] text-text-t4 mt-0.5">Perp / USDT</p>
                </div>

                {/* Fiyat */}
                <div className="text-right mr-2 shrink-0">
                  <p className="font-mono text-[12px] font-semibold text-text-t1 tabular-nums leading-none">
                    {last > 0 ? fmtPrice(last) : "—"}
                  </p>
                  <p className={`font-mono text-[10px] tabular-nums mt-0.5 ${chgColor(chg)}`}>
                    {fmtPct(chg)}
                  </p>
                </div>

                {/* Checkmark */}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                  isWatched
                    ? "bg-brand border-brand"
                    : "border-border bg-transparent"
                }`}>
                  {isWatched && (
                    <span className="text-white font-bold leading-none" style={{ fontSize: 9 }}>✓</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-border bg-bg-card flex items-center justify-between">
          <span className="font-mono text-[11px] text-text-t4">
            {watchedPairs.length === 0
              ? "Henüz coin seçilmedi"
              : `${watchedPairs.length} coin izleniyor`}
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-brand px-4 py-1.5 font-mono text-xs font-bold text-white hover:bg-brand/80 transition-colors"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Detail Card ── */
function PairDetailCard({ activePair }: { activePair: Pair }) {
  const t         = useT();
  const prices    = useMarketStore((s) => s.prices);
  const allScores = useScoreStore((s) => s.results);
  const candles1d = useCandleStore((s) => s.candles[`${activePair}_1d`]);
  const trades    = useTradeFeedStore(selectTrades(activePair));

  const tick      = prices[activePair];
  const last      = tick?.last  ?? 0;
  const chg       = tick?.chg   ?? null;
  const result    = allScores[activePair];
  const sc        = result?.score     ?? null;
  const direction = result?.direction ?? null;
  const verdict   = result?.verdict   ?? null;

  const lastBar = candles1d && candles1d.length > 0 ? candles1d[candles1d.length - 1] : null;
  const high24  = lastBar?.high ?? null;
  const low24   = lastBar?.low  ?? null;

  const cvd = useMemo(() => {
    if (trades.length < 10) return null;
    return computeCvdMultiFrame(activePair, trades, Date.now());
  }, [activePair, trades]);

  const cvdRatio: string | null = useMemo(() => {
    if (!cvd) return null;
    const { buyUsd, sellUsd } = cvd.w15m;
    if (sellUsd === 0) return null;
    const ratio = buyUsd / sellUsd;
    return `${ratio >= 1 ? "+" : ""}${ratio.toFixed(2)}x`;
  }, [cvd]);

  const cvdClr = cvd
    ? cvd.w15m.direction === "bullish" ? "text-emerald-400"
    : cvd.w15m.direction === "bearish" ? "text-red-400"
    : "text-zinc-400"
    : "text-zinc-500";

  const scoreBg =
    sc == null ? "bg-zinc-700"    :
    sc >= 70   ? "bg-emerald-600" :
    sc >= 40   ? "bg-amber-600"   :
                 "bg-red-600";

  const verdictBg =
    verdict === "go"   ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" :
    verdict === "wait" ? "bg-amber-500/20 text-amber-400 border-amber-500/40"       :
    verdict === "no"   ? "bg-red-500/20 text-red-400 border-red-500/40"             :
                         "bg-zinc-800 text-zinc-500 border-zinc-700";

  return (
    <div className="shrink-0 mx-2 mb-2 mt-1 rounded-lg border border-zinc-700 bg-zinc-900/80 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[11px] font-bold text-white tracking-wide">
            {activePair} /&nbsp;USDT
          </span>
          {direction && direction !== "NEUTRAL" && (
            <span className={`font-mono text-[7px] font-bold px-1 py-0.5 rounded leading-none shrink-0 ${
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
      <div className="mb-2.5">
        <div className="font-mono text-[20px] font-bold text-white tabular-nums leading-none">
          {last > 0 ? fmtPrice(last) : "—"}
        </div>
        <div className={`font-mono text-[11px] tabular-nums font-semibold mt-0.5 ${chgColor(chg)}`}>
          {fmtPct(chg)} (24s)
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-2.5">
        <div>
          <p className="text-zinc-500 font-mono text-[7.5px] uppercase tracking-widest mb-0.5">{t("grafik.watchlistVolumeDelta")}</p>
          <p className={`font-mono text-[11px] font-semibold tabular-nums ${cvdClr}`}>{cvdRatio ?? "—"}</p>
        </div>
        <div>
          <p className="text-zinc-500 font-mono text-[7.5px] uppercase tracking-widest mb-0.5">{t("grafik.watchlist24hHigh")}</p>
          <p className="font-mono text-[10px] font-semibold text-emerald-400 tabular-nums">
            {high24 != null && high24 > 0 ? fmtPrice(high24) : "—"}
          </p>
        </div>
        <div>
          <p className="text-zinc-500 font-mono text-[7.5px] uppercase tracking-widest mb-0.5">Karar</p>
          <p className={`font-mono text-[11px] font-bold uppercase ${
            verdict === "go"   ? "text-emerald-400" :
            verdict === "wait" ? "text-amber-400"   :
            verdict === "no"   ? "text-red-400"     : "text-zinc-500"
          }`}>{verdict ? verdict.toUpperCase() : "—"}</p>
        </div>
        <div>
          <p className="text-zinc-500 font-mono text-[7.5px] uppercase tracking-widest mb-0.5">{t("grafik.watchlist24hLow")}</p>
          <p className="font-mono text-[10px] font-semibold text-red-400 tabular-nums">
            {low24 != null && low24 > 0 ? fmtPrice(low24) : "—"}
          </p>
        </div>
      </div>
      <div className={`rounded border py-1 text-center font-mono text-[9px] font-bold tracking-[0.12em] uppercase ${verdictBg}`}>
        {verdict ? verdict.toUpperCase() : "—"}
      </div>
    </div>
  );
}

/* ── Watchlist İçerik (masaüstü dar panel) ── */
function WatchlistContent({ activePair, onPairChange }: Props) {
  const t             = useT();
  const btcD          = useMacroStore((s) => s.btcD);
  const ethD          = useMacroStore((s) => s.ethD);
  const usdtD         = useMacroStore((s) => s.usdtD);
  const btcDChange24h = useMacroStore((s) => s.btcDChange24h);
  const ethDChange24h = useMacroStore((s) => s.ethDChange24h);
  const prices        = useMarketStore((s) => s.prices);
  const allScores     = useScoreStore((s) => s.results);

  const { pairs: watchedPairs, toggle, load } = useWatchlistStore();
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => { load(); }, [load]);

  // Hiç seçili coin yoksa tümünü göster
  const displayPairs = watchedPairs.length > 0
    ? PAIRS.filter((p) => watchedPairs.includes(p))
    : PAIRS;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Dominance */}
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

      {/* Header + Listeye Ekle butonu */}
      <div className={`shrink-0 grid ${GRID_COLS} gap-x-1 px-2 py-1 border-b border-border/50 items-center`}>
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider">Sembol</span>
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider text-right">Son</span>
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider text-right">{t("grafik.watchlistChange")}</span>
        <span className="text-text-t4 font-mono text-[9px] uppercase tracking-wider text-right">%</span>
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center justify-center w-6 h-5 rounded border border-brand/50 bg-brand/10 text-brand hover:bg-brand/20 transition-colors font-mono font-bold leading-none"
          style={{ fontSize: 12 }}
          title="Listeye ekle / çıkar"
        >
          +
        </button>
      </div>

      {/* Coin listesi */}
      <div className={[
        "flex flex-col overflow-y-auto flex-1 min-h-0",
        "[&::-webkit-scrollbar]:w-[3px]",
        "[&::-webkit-scrollbar-thumb]:rounded-full",
        "[&::-webkit-scrollbar-thumb]:bg-border/60",
        "[&::-webkit-scrollbar-track]:bg-transparent",
      ].join(" ")}>
        {displayPairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 gap-2">
            <p className="font-mono text-[10px] text-text-t4 text-center">Henüz coin eklenmedi</p>
            <button
              onClick={() => setPickerOpen(true)}
              className="rounded border border-brand/50 bg-brand/10 text-brand px-2 py-1 font-mono text-[10px] hover:bg-brand/20 transition-colors"
            >
              + Listeye ekle
            </button>
          </div>
        ) : (
          displayPairs.map((pair) => {
            const tick    = prices[pair];
            const last    = tick?.last    ?? 0;
            const open24h = tick?.open24h ?? 0;
            const abs     = open24h > 0 ? last - open24h : 0;
            const chg     = tick?.chg;
            const isActive = pair === activePair;
            const sc = allScores[pair]?.score;
            const scoreBg =
              sc == null ? "" :
              sc >= 70   ? "bg-emerald-600" :
              sc >= 40   ? "bg-amber-600"   : "bg-red-600";

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
                {sc == null ? (
                  <span className="font-mono text-[9px] text-text-t4 text-right">—</span>
                ) : (
                  <span className={`flex items-center justify-center w-8 h-6 rounded font-mono text-xs font-bold text-white tabular-nums ${scoreBg}`}>
                    {sc}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Seçili pair detay kartı */}
      <PairDetailCard activePair={activePair} />

      {/* Coin picker modal */}
      {pickerOpen && (
        <CoinPickerModal
          watchedPairs={watchedPairs}
          onToggle={toggle}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/* ── MobileWatchlistView — tam ekran mobil liste (page.tsx'ten kullanılır) ── */
interface MobileWatchlistProps {
  activePair: Pair;
  onPairSelect: (pair: Pair) => void;
}

export function MobileWatchlistView({ activePair, onPairSelect }: MobileWatchlistProps): React.ReactElement {
  const btcD          = useMacroStore((s) => s.btcD);
  const ethD          = useMacroStore((s) => s.ethD);
  const usdtD         = useMacroStore((s) => s.usdtD);
  const btcDChange24h = useMacroStore((s) => s.btcDChange24h);
  const ethDChange24h = useMacroStore((s) => s.ethDChange24h);
  const prices        = useMarketStore((s) => s.prices);
  const allScores     = useScoreStore((s) => s.results);

  const { pairs: watchedPairs, toggle, load } = useWatchlistStore();
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => { load(); }, [load]);

  // Hiç seçili coin yoksa tümünü göster
  const displayPairs = watchedPairs.length > 0
    ? PAIRS.filter((p) => watchedPairs.includes(p))
    : PAIRS;

  return (
    <div className="flex flex-col min-h-0 flex-1 bg-bg-page">
      {/* Başlık */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-bg-card">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-text-t1 tracking-wide uppercase">
            İzleme Listesi
          </span>
          <span className="font-mono text-xs text-text-t4">
            {watchedPairs.length > 0 ? `${watchedPairs.length}` : `${PAIRS.length}`} çift
          </span>
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-brand/50 bg-brand/10 px-3 py-1.5 font-mono text-xs font-bold text-brand hover:bg-brand/20 active:bg-brand/30 transition-colors"
        >
          + Listeye ekle
        </button>
      </div>

      {/* Dominance */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-2 border-b border-border/50 bg-bg-card/50">
        {([
          { label: "BTC.D", val: btcD,  chg: btcDChange24h },
          { label: "ETH.D", val: ethD,  chg: ethDChange24h },
          { label: "USDT.D", val: usdtD, chg: null },
        ] as const).map(({ label, val, chg }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="font-mono text-[10px] text-text-t4">{label}</span>
            <span className="font-mono text-[10px] font-medium text-text-t2 tabular-nums">{fmtDom(val)}</span>
            {chg !== null && chg !== undefined && (
              <span className={`font-mono text-[9px] ${domChgColor(chg)}`}>
                {chg >= 0 ? "+" : ""}{chg.toFixed(1)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Kolon başlıkları */}
      <div className="shrink-0 grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-4 py-1.5 border-b border-border/40 bg-bg-card/30">
        <span className="font-mono text-[9px] text-text-t4 uppercase tracking-wider">Sembol</span>
        <span />
        <span className="font-mono text-[9px] text-text-t4 uppercase tracking-wider text-right">Fiyat / Değişim</span>
        <span className="font-mono text-[9px] text-text-t4 uppercase tracking-wider text-right w-8">QX</span>
      </div>

      {/* Coin satırları */}
      <div className={[
        "flex-1 overflow-y-auto",
        "[&::-webkit-scrollbar]:w-[3px]",
        "[&::-webkit-scrollbar-thumb]:bg-border/60",
        "[&::-webkit-scrollbar-track]:bg-transparent",
      ].join(" ")}>
        {displayPairs.length === 0 ? (
          /* Boş durum */
          <div className="flex flex-col items-center justify-center py-16 px-8 gap-4">
            <div className="w-14 h-14 rounded-full bg-surface-s2 flex items-center justify-center">
              <span className="text-2xl text-text-t4">☆</span>
            </div>
            <p className="font-mono text-sm font-bold text-text-t2 text-center">
              İzleme listeniz boş
            </p>
            <p className="font-mono text-xs text-text-t4 text-center leading-relaxed">
              Takip etmek istediğiniz coinleri ekleyin
            </p>
            <button
              onClick={() => setPickerOpen(true)}
              className="rounded-xl bg-brand px-6 py-2.5 font-mono text-sm font-bold text-white hover:bg-brand/80 active:scale-95 transition-all"
            >
              + Listeye ekle
            </button>
          </div>
        ) : (
          displayPairs.map((pair) => {
            const tick    = prices[pair];
            const last    = tick?.last    ?? 0;
            const chg     = tick?.chg;
            const isActive = pair === activePair;
            const sc = allScores[pair]?.score;
            const color = pairColor(pair);

            const scoreBg =
              sc == null ? "bg-zinc-700" :
              sc >= 70   ? "bg-emerald-600" :
              sc >= 40   ? "bg-amber-600"   : "bg-red-600";

            return (
              <button
                key={pair}
                onClick={() => onPairSelect(pair)}
                className={[
                  "w-full grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/30",
                  isActive ? "bg-brand/8 border-l-2 border-l-brand" : "active:bg-bg-hover",
                ].join(" ")}
              >
                {/* Coin badge */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-mono text-[11px] font-bold text-white shrink-0"
                  style={{ backgroundColor: color + "30", border: `1.5px solid ${color}60` }}
                >
                  <span style={{ color }}>{pair.slice(0, 3)}</span>
                </div>

                {/* İsim + sub */}
                <div className="min-w-0">
                  <p className={`font-mono text-[13px] font-bold leading-none truncate ${isActive ? "text-brand" : "text-text-t1"}`}>
                    {pair}
                  </p>
                  <p className="font-mono text-[10px] text-text-t4 mt-0.5">Perp / USDT</p>
                </div>

                {/* Fiyat + değişim */}
                <div className="text-right min-w-0">
                  <p className="font-mono text-[13px] font-bold text-text-t1 tabular-nums leading-none">
                    {last > 0 ? fmtPrice(last) : "—"}
                  </p>
                  <p className={`font-mono text-[11px] tabular-nums mt-0.5 ${chgColor(chg)}`}>
                    {fmtPct(chg)}
                  </p>
                </div>

                {/* QX skor rozeti */}
                <div className="shrink-0">
                  {sc == null ? (
                    <span className="font-mono text-[10px] text-text-t4">—</span>
                  ) : (
                    <span className={`flex items-center justify-center w-9 h-7 rounded font-mono text-xs font-bold text-white ${scoreBg}`}>
                      {sc}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Coin picker modal */}
      {pickerOpen && (
        <CoinPickerModal
          watchedPairs={watchedPairs}
          onToggle={toggle}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/* ── WatchlistPanel (masaüstü yan panel) ── */
export function WatchlistPanel({ activePair, onPairChange }: Props): React.ReactElement {
  return (
    <div className="hidden md:flex flex-col border border-border bg-bg-card rounded-lg overflow-hidden select-none w-[266px] shrink-0 self-stretch">
      <WatchlistContent activePair={activePair} onPairChange={onPairChange} />
    </div>
  );
}
