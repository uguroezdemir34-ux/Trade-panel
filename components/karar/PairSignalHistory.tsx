"use client";

import { useMemo } from "react";
import { useScoreHistoryStore } from "@/lib/store/scoreHistoryStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import type { Pair } from "@/lib/constants/pairs";
import { useT } from "@/lib/i18n/context";

type TFn = (key: string, params?: Record<string, string | number>) => string;

function timeAgo(ts: number, t: TFn): string {
  const delta = Date.now() - ts;
  const m = Math.floor(delta / 60_000);
  if (m < 1) return t("common.timeNow");
  if (m < 60) return t("common.timeMinutes", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("common.timeHours", { n: h });
  return t("common.timeDays", { n: Math.floor(h / 24) });
}

export function PairSignalHistory({ pair }: { pair: Pair }): React.ReactElement | null {
  const t = useT();
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
        {t("karar.pairGoHistory", { pair })}
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
            <span className="text-text-t4 shrink-0 tabular-nums">{timeAgo(sig.ts, t)}</span>
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
