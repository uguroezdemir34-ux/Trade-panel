"use client";

import { useMemo, useState, useEffect } from "react";
import { useScoreHistoryStore } from "@/lib/store/scoreHistoryStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

const PAGE_SIZE = 50;
type DirFilter = "all" | "LONG" | "SHORT";

function timeAgo(ts: number): string {
  const delta = Date.now() - ts;
  const m = Math.floor(delta / 60_000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa`;
  return `${Math.floor(h / 24)}g`;
}

function fullTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) + " " + time;
}

function Chip({
  active,
  onClick,
  children,
  colorOn,
}: React.PropsWithChildren<{ active: boolean; onClick: () => void; colorOn?: string }>) {
  const onCls = colorOn ?? "bg-brand/20 border-brand text-brand";
  return (
    <button
      onClick={onClick}
      className={[
        "flex-shrink-0 px-2 py-0.5 rounded font-mono text-2xs border transition-colors",
        active ? onCls : "border-border text-text-t4 hover:text-text-t2",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function GoSignalLog({ emptyFallback }: { emptyFallback?: React.ReactNode } = {}): React.ReactElement | null {
  const history = useScoreHistoryStore((s) => s.history);
  const trades = useTradesStore((s) => s.trades);
  const goAlertsEnabled = useSettingsStore((s) => s.goAlertsEnabled);

  const [filterPair, setFilterPair] = useState<Pair | "all">("all");
  const [filterDir, setFilterDir] = useState<DirFilter>("all");
  const [minScore, setMinScore] = useState(0);
  const [page, setPage] = useState(1);

  // All GO verdicts across all pairs, newest first
  const allGoEntries = useMemo(() => {
    const entries: { pair: Pair; score: number; direction: string; ts: number }[] = [];
    for (const pair of PAIRS) {
      for (const snap of history[pair] ?? []) {
        if (snap.verdict === "go") {
          entries.push({ pair, score: snap.score, direction: snap.direction, ts: snap.ts });
        }
      }
    }
    return entries.sort((a, b) => b.ts - a.ts);
  }, [history]);

  // Pairs that have at least one GO entry (for filter chips)
  const activePairs = useMemo(() => {
    const seen = new Set<Pair>();
    for (const e of allGoEntries) seen.add(e.pair);
    return Array.from(seen);
  }, [allGoEntries]);

  // Cross-reference: was a trade opened within 15 min after this signal?
  const convertedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const e of allGoEntries) {
      const eDir = e.direction.toUpperCase();
      const match = trades.find(
        (tr) =>
          tr.pair === e.pair &&
          tr.direction === eDir &&
          Math.abs(tr.openedAt - e.ts) < 15 * 60_000,
      );
      if (match) set.add(`${e.pair}_${e.ts}`);
    }
    return set;
  }, [allGoEntries, trades]);

  // Reset page to 1 when new signals arrive (so fresh entries at top are visible)
  useEffect(() => {
    setPage(1);
  }, [allGoEntries.length]);

  // Apply filters
  const filtered = useMemo(
    () =>
      allGoEntries.filter(
        (e) =>
          (filterPair === "all" || e.pair === filterPair) &&
          (filterDir === "all" || e.direction === filterDir) &&
          e.score >= minScore,
      ),
    [allGoEntries, filterPair, filterDir, minScore],
  );

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  if (allGoEntries.length === 0) return emptyFallback ? <>{emptyFallback}</> : null;

  return (
    <div className="border-border bg-bg-card rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-text-t4 font-mono text-2xs tracking-widest uppercase">
          GO Sinyal Geçmişi
        </span>
        <div className="flex items-center gap-2">
          {goAlertsEnabled && (
            <span className="text-green-400 font-mono text-2xs" title="Telegram bildirimleri açık">
              📡
            </span>
          )}
          <span className="text-green-400 font-mono text-2xs font-semibold">
            {filtered.length}
          </span>
        </div>
      </div>

      {/* Pair filter chips */}
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-border/30 -scrollbar-thin">
        <Chip active={filterPair === "all"} onClick={() => { setFilterPair("all"); setPage(1); }}>
          Tümü
        </Chip>
        {activePairs.map((p) => (
          <Chip key={p} active={filterPair === p} onClick={() => { setFilterPair(p); setPage(1); }}>
            {p}
          </Chip>
        ))}
      </div>

      {/* Direction + score filters */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/20 flex-wrap">
        <div className="flex gap-1">
          <Chip active={filterDir === "all"} onClick={() => { setFilterDir("all"); setPage(1); }}>
            ALL
          </Chip>
          <Chip
            active={filterDir === "LONG"}
            colorOn="bg-green-500/20 border-green-500 text-green-400"
            onClick={() => { setFilterDir("LONG"); setPage(1); }}
          >
            ▲ LONG
          </Chip>
          <Chip
            active={filterDir === "SHORT"}
            colorOn="bg-red-500/20 border-red-500 text-red-400"
            onClick={() => { setFilterDir("SHORT"); setPage(1); }}
          >
            ▼ SHORT
          </Chip>
        </div>
        <div className="flex gap-1">
          {[0, 60, 70, 80].map((s) => (
            <Chip
              key={s}
              active={minScore === s}
              onClick={() => { setMinScore(s); setPage(1); }}
            >
              {s === 0 ? "Hepsi" : `${s}+`}
            </Chip>
          ))}
        </div>
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="px-3 py-6 text-center text-text-t4 font-mono text-2xs">
          Bu filtre için sinyal yok
        </div>
      ) : (
        <>
          <div className="divide-y divide-border/15 max-h-80 overflow-y-auto">
            {paginated.map((e) => {
              const isLong = e.direction.toUpperCase() === "LONG";
              const converted = convertedKeys.has(`${e.pair}_${e.ts}`);
              return (
                <div
                  key={`${e.pair}_${e.ts}`}
                  className="grid items-center gap-x-2 px-3 py-1.5 font-mono text-2xs"
                  style={{ gridTemplateColumns: "36px 56px 28px 12px 1fr" }}
                >
                  <span className="text-text-t2 font-bold tracking-wide">{e.pair}</span>
                  <span className={isLong ? "text-green-400" : "text-red-400"}>
                    {isLong ? "▲ LONG" : "▼ SHORT"}
                  </span>
                  <span className="text-green-400 tabular-nums font-bold">{e.score}</span>
                  <span
                    className={converted ? "text-green-400" : "text-text-t4/30"}
                    title={converted ? "Bu sinyalden sonra işlem açıldı" : "İşlem açılmadı"}
                  >
                    {converted ? "✓" : "·"}
                  </span>
                  <span
                    className="text-text-t4 tabular-nums text-right"
                    title={fullTime(e.ts)}
                  >
                    {timeAgo(e.ts)}
                  </span>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <button
              onClick={() => setPage((p) => p + 1)}
              className="w-full py-2 text-center font-mono text-2xs text-text-t4 hover:text-brand border-t border-border/30 transition-colors"
            >
              Daha fazla göster ({filtered.length - paginated.length} kaldı)
            </button>
          )}
        </>
      )}
    </div>
  );
}
