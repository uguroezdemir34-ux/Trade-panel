"use client";

import { useMemo } from "react";
import { useScoreHistoryStore } from "@/lib/store/scoreHistoryStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import type { Pair } from "@/lib/constants/pairs";

function timeAgo(ts: number): string {
  const delta = Date.now() - ts;
  const m = Math.floor(delta / 60_000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa`;
  return `${Math.floor(h / 24)}g`;
}

export function PairSignalHistory({ pair }: { pair: Pair }): React.ReactElement | null {
  const history = useScoreHistoryStore((s) => s.history);
  const trades = useTradesStore((s) => s.trades);

  const signals = useMemo(() => {
    const snaps = history[pair] ?? [];
    return snaps
      .filter((s) => s.verdict === "go")
      .slice(-5)
      .reverse();
  }, [history, pair]);

  if (signals.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-surface-s1 px-3 py-2 flex flex-col gap-1.5">
      <span className="font-mono text-2xs text-text-t4 tracking-wider uppercase">
        {pair} GO Geçmişi
      </span>
      {signals.map((sig) => {
        const dirUp = sig.direction.toUpperCase() as "LONG" | "SHORT" | "NEUTRAL";
        const wasTaken = trades.some(
          (tr) =>
            tr.pair === pair &&
            tr.direction === dirUp &&
            Math.abs(tr.openedAt - sig.ts) < 15 * 60_000,
        );
        const fullTime = new Date(sig.ts).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const dirLabel =
          dirUp === "LONG" ? "▲ L" : dirUp === "SHORT" ? "▼ S" : "↔ N";
        const dirColor =
          dirUp === "LONG"
            ? "text-signal-green"
            : dirUp === "SHORT"
            ? "text-signal-red"
            : "text-text-t3";
        return (
          <div key={`${sig.ts}_${sig.score}`} className="flex items-center gap-2 font-mono text-2xs">
            <span className="text-text-t4 shrink-0 tabular-nums">{timeAgo(sig.ts)}</span>
            <span className="text-text-t4 shrink-0 tabular-nums">{fullTime}</span>
            <span className={`shrink-0 font-semibold ${dirColor}`}>{dirLabel}</span>
            <span className="text-text-t3 tabular-nums w-6 text-right">{sig.score}</span>
            {wasTaken ? (
              <span className="text-brand text-[8px] font-bold ml-1">✓</span>
            ) : (
              <span className="text-text-t4 text-[8px] ml-1">—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
