"use client";

import { useMarketStore } from "@/lib/store/marketStore";
import { useMacroStore } from "@/lib/store/macroStore";
import { PAIRS } from "@/lib/constants/pairs";
import { useLocale } from "@/lib/i18n/context";
import { formatTickPrice } from "@/lib/i18n/format";

function fmtVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

function fmtMcap(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `${(v / 1e6).toFixed(0)}M`;
  return v.toFixed(0);
}

interface LivePriceStripProps {
  variant?: "horizontal" | "vertical";
}

export function LivePriceStrip({ variant = "horizontal" }: LivePriceStripProps): React.ReactElement {
  const locale    = useLocale();
  const prices    = useMarketStore((s) => s.prices);
  const marketCap = useMacroStore((s) => s.marketCap);

  const isVertical = variant === "vertical";

  const cards = PAIRS.map((pair) => {
    const tick = prices[pair];
    const chg  = tick?.chg ?? null;
    const pos  = chg !== null && chg > 0;
    const neg  = chg !== null && chg < 0;
    const chgColor     = pos ? "text-green-400" : neg ? "text-red-400" : "text-text-t4";
    const accentBorder = pos
      ? "border-l-green-500/60"
      : neg
        ? "border-l-red-500/60"
        : "border-l-border/30";
    const mc = marketCap[pair];

    return (
      <div
        key={pair}
        className={`flex flex-col gap-0.5 rounded border border-border/40 border-l-2 ${accentBorder} bg-bg-card px-2.5 py-2 ${isVertical ? "w-full" : "min-w-[82px] shrink-0"}`}
      >
        {/* Pair name */}
        <span className="font-mono text-[10px] font-semibold tracking-widest text-text-t3 uppercase leading-none">
          {pair}
        </span>

        {/* Live price */}
        <span
          translate="no"
          className="font-mono text-xs font-bold tabular-nums text-text-t1 leading-none mt-1"
        >
          {tick ? formatTickPrice(tick.last, locale) : "—"}
        </span>

        {/* 24h change */}
        <span
          translate="no"
          className={`font-mono text-[10px] tabular-nums leading-none ${chgColor}`}
        >
          {chg !== null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%` : "—"}
        </span>

        {/* 24h volume */}
        {tick?.vol24h !== undefined && (
          <span
            translate="no"
            className="font-mono text-[9px] tabular-nums text-text-t4 leading-none mt-0.5"
          >
            V ${fmtVol(tick.vol24h)}
          </span>
        )}

        {/* Market cap */}
        {mc !== undefined && (
          <span
            translate="no"
            className="font-mono text-[9px] tabular-nums text-text-t4 leading-none"
          >
            MC ${fmtMcap(mc)}
          </span>
        )}
      </div>
    );
  });

  if (isVertical) {
    return (
      <div className="flex flex-col gap-1.5 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] w-[90px] shrink-0" style={{ maxHeight: "calc(100vh - 120px)" }}>
        {cards}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      <div className="flex gap-1.5 pb-0.5" style={{ minWidth: "max-content" }}>
        {cards}
      </div>
    </div>
  );
}
