"use client";

/**
 * TOP TRADES CARD — Best 3 wins and worst 3 losses by P&L.
 */

import { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import type { TradeRecord } from "@/lib/pnl/types";

interface Props {
  trades: readonly TradeRecord[];
}

export function TopTradesCard({ trades }: Props): React.ReactElement | null {
  const t = useT();
  const { winners, losers } = useMemo(() => {
    const sorted = [...trades].sort((a, b) => b.pnlUsd - a.pnlUsd);
    return {
      winners: sorted.slice(0, 3).filter((t) => t.pnlUsd > 0),
      losers: sorted.slice(-3).filter((t) => t.pnlUsd < 0).reverse(),
    };
  }, [trades]);

  if (winners.length === 0 && losers.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Best trades */}
      {winners.length > 0 && (
        <div className="border border-green-500/20 bg-green-500/5 rounded-lg p-3">
          <h3 className="text-green-400 font-mono text-2xs tracking-widest uppercase mb-2">
            🏆 {t("pnl.topTrades.winners")}
          </h3>
          <div className="flex flex-col gap-1.5">
            {winners.map((t, i) => (
              <TradeRow key={i} trade={t} positive />
            ))}
          </div>
        </div>
      )}

      {/* Worst trades */}
      {losers.length > 0 && (
        <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-3">
          <h3 className="text-red-400 font-mono text-2xs tracking-widest uppercase mb-2">
            💀 {t("pnl.topTrades.losers")}
          </h3>
          <div className="flex flex-col gap-1.5">
            {losers.map((t, i) => (
              <TradeRow key={i} trade={t} positive={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TradeRow({ trade, positive }: { trade: TradeRecord; positive: boolean }) {
  const sign = trade.pnlUsd >= 0 ? "+" : "";
  const dateStr = new Date(trade.closedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="grid items-center font-mono text-xs tabular-nums gap-x-2"
      style={{ gridTemplateColumns: "auto auto 1fr auto auto" }}>
      <span className={`font-bold text-2xs ${trade.direction === "LONG" ? "text-green-400" : "text-red-400"}`}>
        {trade.direction === "LONG" ? "▲" : "▼"}
      </span>
      <span className="text-text-t2 font-semibold w-12">{trade.pair}</span>
      <span className="text-text-t4 text-2xs truncate">{dateStr}</span>
      {trade.closeReason && (
        <span className="text-text-t4 text-2xs uppercase">{trade.closeReason}</span>
      )}
      <span className={`font-bold text-right ${positive ? "text-green-400" : "text-red-400"}`}>
        {sign}${Math.abs(trade.pnlUsd).toFixed(2)}
      </span>
    </div>
  );
}
