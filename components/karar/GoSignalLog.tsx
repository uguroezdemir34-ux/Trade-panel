"use client";

import { useMemo } from "react";
import { useScoreHistoryStore } from "@/lib/store/scoreHistoryStore";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

const MAX_ENTRIES = 20;

function timeAgo(ts: number): string {
  const delta = Date.now() - ts;
  const m = Math.floor(delta / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function GoSignalLog(): React.ReactElement | null {
  const history = useScoreHistoryStore((s) => s.history);

  const goEntries = useMemo(() => {
    const entries: { pair: Pair; score: number; direction: string; ts: number }[] = [];
    for (const pair of PAIRS) {
      const snaps = history[pair] ?? [];
      for (const snap of snaps) {
        if (snap.verdict === "go") {
          entries.push({ pair, score: snap.score, direction: snap.direction, ts: snap.ts });
        }
      }
    }
    return entries.sort((a, b) => b.ts - a.ts).slice(0, MAX_ENTRIES);
  }, [history]);

  if (goEntries.length === 0) return null;

  return (
    <div className="border-border bg-bg-card rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
        <span className="text-text-t4 font-mono text-2xs tracking-widest uppercase">
          Recent GO Signals
        </span>
        <span className="text-green-400 font-mono text-2xs font-semibold">
          {goEntries.length}
        </span>
      </div>
      <div className="divide-y divide-border/20 max-h-48 overflow-y-auto">
        {goEntries.map((e, idx) => {
          const isLong = e.direction === "LONG";
          return (
            <div
              key={idx}
              className="grid items-center gap-x-2 px-3 py-1 font-mono text-2xs"
              style={{ gridTemplateColumns: "36px 1fr auto auto" }}
            >
              <span className="text-text-t3 font-semibold tracking-wide">{e.pair}</span>
              <span className={`${isLong ? "text-green-400" : "text-red-400"}`}>
                {isLong ? "▲ LONG" : "▼ SHORT"}
              </span>
              <span className="text-green-400 tabular-nums font-semibold">{e.score}</span>
              <span className="text-text-t4 tabular-nums w-8 text-right">{timeAgo(e.ts)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
