"use client";

import { useMarketStore } from "@/lib/store/marketStore";
import { useScoreStore } from "@/lib/store/scoreStore";
import { PAIRS } from "@/lib/constants/pairs";

const VERDICT_DOT: Record<string, string> = {
  go:   "bg-green-400",
  wait: "bg-yellow-400",
  no:   "bg-red-400/60",
};

function fmtPrice(p: number): string {
  if (p >= 10_000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 100)    return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1)      return p.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return p.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function PriceTable(): React.ReactElement {
  const prices = useMarketStore((s) => s.prices);
  const results = useScoreStore((s) => s.results);

  const rows = PAIRS.map((pair) => ({
    pair,
    tick: prices[pair],
    result: results[pair],
  }));

  const anyData = rows.some((r) => !!r.tick);

  return (
    <div className="border-border bg-bg-card rounded-lg border overflow-hidden">
      {/* Header */}
      <div
        className="grid items-center gap-x-2 px-3 py-1.5 border-b border-border/50"
        style={{ gridTemplateColumns: "44px 1fr 64px 40px 16px" }}
      >
        <span className="text-text-t4 font-mono text-2xs tracking-wider uppercase">Pair</span>
        <span className="text-text-t4 font-mono text-2xs tracking-wider text-right">Price</span>
        <span className="text-text-t4 font-mono text-2xs tracking-wider text-right">24h %</span>
        <span className="text-text-t4 font-mono text-2xs tracking-wider text-right">Score</span>
        <span />
      </div>

      {/* Rows */}
      {!anyData ? (
        <div className="px-3 py-4 text-text-t4 font-mono text-xs text-center">
          Bağlanıyor...
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {rows.map(({ pair, tick, result }) => {
            const chg = tick?.chg ?? null;
            const verdict = result?.verdict;
            const score = result?.score;
            const dir = result?.direction;
            const chgColor = chg === null ? "text-text-t4" : chg > 0 ? "text-green-400" : chg < 0 ? "text-red-400" : "text-text-t3";
            const dirArrow = dir === "LONG" ? "▲" : dir === "SHORT" ? "▼" : "";
            const dotClass = verdict ? (VERDICT_DOT[verdict] ?? "bg-border") : "bg-border/30";

            return (
              <div
                key={pair}
                className="grid items-center gap-x-2 px-3 py-1.5"
                style={{ gridTemplateColumns: "44px 1fr 64px 40px 16px" }}
              >
                {/* Pair */}
                <span className="text-text-t2 font-mono text-xs font-semibold">{pair}</span>

                {/* Price */}
                <span className="text-text-t1 font-mono text-xs tabular-nums text-right">
                  {tick ? `$${fmtPrice(tick.last)}` : "—"}
                </span>

                {/* 24h change */}
                <span className={`font-mono text-xs tabular-nums text-right ${chgColor}`}>
                  {chg !== null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%` : "—"}
                </span>

                {/* Score + direction */}
                <span className={`font-mono text-xs tabular-nums text-right ${
                  verdict === "go" ? "text-green-400" :
                  verdict === "wait" ? "text-yellow-400" :
                  verdict === "no" ? "text-red-400/70" : "text-text-t4"
                }`}>
                  {score !== undefined ? `${score}${dirArrow}` : "—"}
                </span>

                {/* Verdict dot */}
                <div className="flex justify-center">
                  <div className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
