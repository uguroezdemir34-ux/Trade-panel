"use client";

import { useMemo, useState, useEffect } from "react";
import { useGoSignalLogStore } from "@/lib/store/goSignalLogStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import type { Pair } from "@/lib/constants/pairs";
import { useT } from "@/lib/i18n/context";

const PAGE_SIZE = 50;
type DirFilter = "all" | "LONG" | "SHORT";
type RangeFilter = "all" | "today" | "7d" | "30d";
type TradeResult = "profit" | "loss" | "open" | null;

function timeAgo(ts: number, t: (key: string, params?: Record<string, string | number>) => string): string {
  const delta = Date.now() - ts;
  const m = Math.floor(delta / 60_000);
  if (m < 1) return t("common.timeNow");
  if (m < 60) return t("common.timeMinutes", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("common.timeHours", { n: h });
  return t("common.timeDays", { n: Math.floor(h / 24) });
}

function formatTriggerPrice(n: number): string {
  if (n <= 0) return "—";
  if (n >= 10_000) return `$${n.toLocaleString("en", { maximumFractionDigits: 0 })}`;
  if (n >= 100) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
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
  const t = useT();
  const entries = useGoSignalLogStore((s) => s.entries);
  const trades = useTradesStore((s) => s.trades);
  const goAlertsEnabled = useSettingsStore((s) => s.goAlertsEnabled);

  const [filterPair, setFilterPair] = useState<Pair | "all">("all");
  const [filterDir, setFilterDir] = useState<DirFilter>("all");
  const [filterRange, setFilterRange] = useState<RangeFilter>("all");
  const [minScore, setMinScore] = useState(0);
  const [page, setPage] = useState(1);

  // All GO entries, newest first
  const allGoEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.ts - a.ts);
  }, [entries]);

  // Pairs that have at least one GO entry (for filter chips)
  const activePairs = useMemo(() => {
    const seen = new Set<Pair>();
    for (const e of allGoEntries) seen.add(e.pair);
    return Array.from(seen);
  }, [allGoEntries]);

  // Ambiguous: same pair has another GO within ±15 min → trade attribution uncertain
  const ambiguousSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < allGoEntries.length; i++) {
      for (let j = i + 1; j < allGoEntries.length; j++) {
        const a = allGoEntries[i];
        const b = allGoEntries[j];
        if (a.pair === b.pair && Math.abs(a.ts - b.ts) < 15 * 60_000) {
          set.add(`${a.pair}_${a.ts}`);
          set.add(`${b.pair}_${b.ts}`);
        }
      }
    }
    return set;
  }, [allGoEntries]);

  // Trade cross-reference with outcome type
  const convertedMap = useMemo(() => {
    const map = new Map<string, TradeResult>();
    for (const e of allGoEntries) {
      const match = trades.find(
        (tr) =>
          tr.pair === e.pair &&
          tr.direction === e.direction &&
          Math.abs(tr.openedAt - e.ts) < 15 * 60_000,
      );
      if (!match) continue;
      if (match.status === "open") {
        map.set(`${e.pair}_${e.ts}`, "open");
      } else if (match.exit != null) {
        map.set(`${e.pair}_${e.ts}`, match.exit.pnlUsd > 0 ? "profit" : "loss");
      }
    }
    return map;
  }, [allGoEntries, trades]);

  // Reset page to 1 when new signals arrive (so fresh entries at top are visible)
  useEffect(() => {
    setPage(1);
  }, [allGoEntries.length]);

  // Apply filters
  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      filterRange === "today"
        ? new Date().setHours(0, 0, 0, 0)
        : filterRange === "7d"
        ? now - 7 * 86_400_000
        : filterRange === "30d"
        ? now - 30 * 86_400_000
        : 0;
    return allGoEntries.filter(
      (e) =>
        (filterPair === "all" || e.pair === filterPair) &&
        (filterDir === "all" || e.direction === filterDir) &&
        e.score >= minScore &&
        (filterRange === "all" || e.ts >= cutoff),
    );
  }, [allGoEntries, filterPair, filterDir, minScore, filterRange]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  if (allGoEntries.length === 0) return emptyFallback ? <>{emptyFallback}</> : null;

  return (
    <div className="border-border bg-bg-card rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="text-text-t4 font-mono text-2xs tracking-widest uppercase">
          {t("karar.goSignalTitle")}
        </span>
        <div className="flex items-center gap-2">
          {goAlertsEnabled && (
            <span className="text-green-400 font-mono text-2xs" title={t("karar.telegramAlertsOn")}>
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
          {t("common.all")}
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
              {s === 0 ? t("karar.scoreFilterAll") : `${s}+`}
            </Chip>
          ))}
        </div>
      </div>

      {/* Time range filter */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-border/20">
        {(["all", "today", "7d", "30d"] as RangeFilter[]).map((r) => (
          <Chip key={r} active={filterRange === r} onClick={() => { setFilterRange(r); setPage(1); }}>
            {r === "all" ? t("common.all") : r === "today" ? t("common.today") : r === "7d" ? t("common.days7") : t("common.days30")}
          </Chip>
        ))}
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="px-3 py-6 text-center text-text-t4 font-mono text-2xs">
          {t("karar.noSignalsFilter")}
        </div>
      ) : (
        <>
          <div className="divide-y divide-border/15 max-h-80 overflow-y-auto">
            {paginated.map((e) => {
              const key = `${e.pair}_${e.ts}`;
              const isLong = e.direction === "LONG";
              const tradeResult = convertedMap.get(key) ?? null;
              const isAmbiguous = ambiguousSet.has(key);
              const priceStale = e.priceWasStale === true;
              const isUncertain = isAmbiguous || priceStale;

              const resultIcon =
                tradeResult === "profit" ? "✓"
                : tradeResult === "loss" ? "✗"
                : tradeResult === "open" ? "⟳"
                : "·";
              const resultColor =
                tradeResult === "profit" ? "text-green-400"
                : tradeResult === "loss" ? "text-red-400"
                : tradeResult === "open" ? "text-yellow-400"
                : "text-text-t4/30";
              const resultTitle =
                tradeResult === "profit" ? t("karar.tradeProfit")
                : tradeResult === "loss" ? t("karar.tradeLoss")
                : tradeResult === "open" ? t("karar.tradeOpen")
                : t("karar.noTradeAfterSignal");

              return (
                <div
                  key={key}
                  className={[
                    "grid items-center gap-x-2 px-3 py-1.5 font-mono text-2xs",
                    isUncertain ? "opacity-60" : "",
                  ].join(" ")}
                  style={{ gridTemplateColumns: "40px 52px 28px 52px 12px 1fr" }}
                  title={
                    isAmbiguous ? t("karar.ambiguousSignal")
                    : priceStale ? t("karar.stalePriceAtSignal")
                    : undefined
                  }
                >
                  <span className="text-text-t2 font-bold tracking-wide">
                    {e.pair}
                    {isUncertain && <span className="text-yellow-500/60 ml-0.5 font-normal">~</span>}
                  </span>
                  <span className={isLong ? "text-green-400" : "text-red-400"}>
                    {isLong ? "▲ LONG" : "▼ SHORT"}
                  </span>
                  <span className="text-green-400 tabular-nums font-bold">{e.score}</span>
                  <span className="text-text-t4 tabular-nums text-right">
                    {formatTriggerPrice(e.triggerPriceAtGo)}
                  </span>
                  <span className={resultColor} title={resultTitle}>
                    {resultIcon}
                  </span>
                  <span
                    className="text-text-t4 tabular-nums text-right"
                    title={fullTime(e.ts)}
                  >
                    {timeAgo(e.ts, t)}
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
              {t("common.showMore", { n: filtered.length - paginated.length })}
            </button>
          )}
        </>
      )}
    </div>
  );
}
