"use client";

/**
 * PARAMETER AUDIT — Skor kalibrasyon ve performans analizi.
 *
 * Dört bölüm:
 *  1. Score Bucket Analysis  — hangi skor aralığı en iyi sonuç verir
 *  2. Direction & Pair Breakdown — LONG/SHORT, BTC/ETH
 *  3. Exit Distribution — TP1/TP2/SL/manual oranları
 *  4. Macro Context — F&G zonu, counter-trend etkisi
 */

import type { CalibrationStats } from "@/lib/pnl/calibration";

interface Props {
  stats: CalibrationStats;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

function usd(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}$${Math.abs(v).toFixed(1)}`;
}

function winColor(rate: number): string {
  if (rate >= 0.6) return "#22C55E";
  if (rate >= 0.5) return "#86EFAC";
  if (rate >= 0.4) return "#F59E0B";
  return "#EF4444";
}

function pnlColor(val: number): string {
  return val > 0 ? "#22C55E" : val < 0 ? "#EF4444" : "rgb(var(--text-t3))";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: React.PropsWithChildren<Record<never, never>>) {
  return (
    <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
      {children}
    </span>
  );
}

function EmptyNote({ label }: { label: string }) {
  return (
    <div className="flex h-[60px] items-center justify-center">
      <span className="text-text-t4 font-mono text-2xs tracking-wider">{label}</span>
    </div>
  );
}

/** Thin progress bar — max bar fills to 100% */
function WinBar({ rate, count }: { rate: number; count: number }) {
  if (count === 0) return <span className="text-text-t4 font-mono text-2xs">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-bg-card2">
        <div
          className="h-full rounded-full"
          style={{ width: `${rate * 100}%`, background: winColor(rate) }}
        />
      </div>
      <span
        className="font-mono text-2xs tabular-nums"
        style={{ color: winColor(rate) }}
      >
        {pct(rate)}
      </span>
    </div>
  );
}

// ── Score Bucket Table ────────────────────────────────────────────────────────

function ScoreBucketSection({ buckets }: { buckets: CalibrationStats["scoreBuckets"] }) {
  const active = buckets.filter((b) => b.tradeCount > 0);
  const maxCount = Math.max(...buckets.map((b) => b.tradeCount), 1);

  return (
    <div className="bg-bg-card border-border rounded-lg border p-3">
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle>Score Bucket Analysis</SectionTitle>
        <span className="text-text-t4 font-mono text-2xs">win rate per range</span>
      </div>

      {active.length === 0 ? (
        <EmptyNote label="No scored trades yet" />
      ) : (
        <div className="flex flex-col gap-1.5">
          {/* Header */}
          <div className="grid grid-cols-[56px_1fr_52px_52px_52px] gap-x-2 pb-1">
            {["Range", "Trades", "Win%", "Avg $", "Avg R"].map((h) => (
              <span key={h} className="text-text-t4 font-mono text-[9px] uppercase tracking-wider">
                {h}
              </span>
            ))}
          </div>

          {buckets.map((b) => (
            <div
              key={b.label}
              className="grid grid-cols-[56px_1fr_52px_52px_52px] items-center gap-x-2"
              style={{ opacity: b.tradeCount === 0 ? 0.3 : 1 }}
            >
              {/* Range label */}
              <span className="text-text-t2 font-mono text-xs font-medium tabular-nums">
                {b.label}
              </span>

              {/* Trade count bar */}
              <div className="flex items-center gap-1.5">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-card2">
                  <div
                    className="h-full rounded-full bg-border-strong"
                    style={{ width: `${(b.tradeCount / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-text-t3 font-mono text-[9px] tabular-nums w-4 text-right">
                  {b.tradeCount}
                </span>
              </div>

              {/* Win rate */}
              <div>
                {b.tradeCount > 0 ? (
                  <span
                    className="font-mono text-xs tabular-nums"
                    style={{ color: winColor(b.winRate) }}
                  >
                    {pct(b.winRate)}
                  </span>
                ) : (
                  <span className="text-text-t4 font-mono text-xs">—</span>
                )}
              </div>

              {/* Avg PnL */}
              <span
                className="font-mono text-xs tabular-nums"
                style={{ color: b.tradeCount > 0 ? pnlColor(b.avgPnlUsd) : "rgb(var(--text-t4))" }}
              >
                {b.tradeCount > 0 ? usd(b.avgPnlUsd) : "—"}
              </span>

              {/* Avg R */}
              <span
                className="font-mono text-xs tabular-nums"
                style={{
                  color:
                    b.avgRMultiple != null
                      ? pnlColor(b.avgRMultiple)
                      : "rgb(var(--text-t4))",
                }}
              >
                {b.avgRMultiple != null ? `${b.avgRMultiple.toFixed(2)}R` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Segment Grid ──────────────────────────────────────────────────────────────

function SegmentCard({
  title,
  segments,
}: {
  title: string;
  segments: CalibrationStats["directionStats"] | CalibrationStats["pairStats"];
}) {
  return (
    <div className="bg-bg-card border-border rounded-lg border p-3">
      <div className="mb-2.5">
        <SectionTitle>{title}</SectionTitle>
      </div>

      {segments.length === 0 ? (
        <EmptyNote label="No data" />
      ) : (
        <div className="flex flex-col gap-2">
          {segments.map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-text-t2 font-mono text-xs font-medium">
                  {s.label}
                </span>
                <span className="text-text-t3 font-mono text-[9px]">
                  {s.tradeCount} trades
                </span>
              </div>
              <div className="flex items-center justify-between">
                <WinBar rate={s.winRate} count={s.tradeCount} />
                <span
                  className="font-mono text-xs tabular-nums"
                  style={{ color: pnlColor(s.totalPnlUsd) }}
                >
                  {usd(s.totalPnlUsd)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Exit Distribution ─────────────────────────────────────────────────────────

const EXIT_COLORS: Record<string, string> = {
  tp1: "#22C55E",
  tp2: "#16A34A",
  sl: "#EF4444",
  manual: "#F59E0B",
  trail: "#3B82F6",
};

function ExitDistSection({ buckets }: { buckets: CalibrationStats["exitBuckets"] }) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="bg-bg-card border-border rounded-lg border p-3">
      <div className="mb-3">
        <SectionTitle>Exit Distribution</SectionTitle>
      </div>

      {buckets.length === 0 ? (
        <EmptyNote label="No exit data" />
      ) : (
        <div className="flex flex-col gap-2">
          {buckets.map((b) => (
            <div key={b.reason} className="flex items-center gap-2">
              {/* Reason label */}
              <span
                className="w-10 font-mono text-xs font-medium uppercase"
                style={{ color: EXIT_COLORS[b.reason] ?? "rgb(var(--text-t2))" }}
              >
                {b.reason}
              </span>

              {/* Bar */}
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-card2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(b.count / maxCount) * 100}%`,
                    background: EXIT_COLORS[b.reason] ?? "rgb(var(--border-strong))",
                    opacity: 0.8,
                  }}
                />
              </div>

              {/* Count + pct */}
              <span className="text-text-t3 w-14 text-right font-mono text-[9px] tabular-nums">
                {b.count} ({pct(b.pct)})
              </span>

              {/* Avg PnL */}
              <span
                className="w-14 text-right font-mono text-xs tabular-nums"
                style={{ color: pnlColor(b.avgPnlUsd) }}
              >
                {usd(b.avgPnlUsd)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Macro Context ─────────────────────────────────────────────────────────────

function MacroSection({
  fgZones,
  counterTrendStats,
  avgRMultiple,
  positiveRCount,
  positiveRPct,
  totalTrades,
}: Pick<
  CalibrationStats,
  "fgZones" | "counterTrendStats" | "avgRMultiple" | "positiveRCount" | "positiveRPct" | "totalTrades"
>) {
  return (
    <div className="bg-bg-card border-border rounded-lg border p-3">
      <div className="mb-3">
        <SectionTitle>Macro Context & R-Multiple</SectionTitle>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* F&G Zones */}
        <div>
          <span className="text-text-t3 mb-1.5 block font-mono text-[9px] uppercase tracking-wider">
            Fear &amp; Greed Zone
          </span>
          {fgZones.length === 0 ? (
            <span className="text-text-t4 font-mono text-2xs">No F&G data</span>
          ) : (
            <div className="flex flex-col gap-1">
              {fgZones.map((z) => (
                <div key={z.label} className="flex items-center justify-between gap-1">
                  <span className="text-text-t3 font-mono text-[9px]">{z.label}</span>
                  <div className="flex items-center gap-1">
                    <span
                      className="font-mono text-[9px] tabular-nums"
                      style={{ color: winColor(z.winRate) }}
                    >
                      {pct(z.winRate)}
                    </span>
                    <span className="text-text-t4 font-mono text-[9px]">
                      ({z.tradeCount})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Counter-Trend */}
        <div>
          <span className="text-text-t3 mb-1.5 block font-mono text-[9px] uppercase tracking-wider">
            Trend Alignment
          </span>
          {counterTrendStats.length === 0 ? (
            <span className="text-text-t4 font-mono text-2xs">No data</span>
          ) : (
            <div className="flex flex-col gap-2">
              {counterTrendStats.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between">
                    <span className="text-text-t2 font-mono text-xs">{s.label}</span>
                    <span className="text-text-t3 font-mono text-[9px]">
                      {s.tradeCount}
                    </span>
                  </div>
                  <WinBar rate={s.winRate} count={s.tradeCount} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* R-Multiple */}
        <div>
          <span className="text-text-t3 mb-1.5 block font-mono text-[9px] uppercase tracking-wider">
            R-Multiple
          </span>
          {avgRMultiple == null ? (
            <span className="text-text-t4 font-mono text-2xs">No R data</span>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-text-t3 font-mono text-[9px]">Avg R</span>
                <span
                  className="font-mono text-xs font-bold tabular-nums"
                  style={{ color: pnlColor(avgRMultiple) }}
                >
                  {avgRMultiple.toFixed(2)}R
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-t3 font-mono text-[9px]">+R trades</span>
                <span className="text-text-t2 font-mono text-xs tabular-nums">
                  {positiveRCount} / {totalTrades} ({pct(positiveRPct)})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ParameterAudit({ stats }: Props): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-text-t1 font-mono text-sm font-semibold tracking-wide">
          Parameter Audit
        </span>
        <span className="text-text-t4 font-mono text-2xs">
          {stats.totalTrades} closed trade{stats.totalTrades !== 1 ? "s" : ""} analyzed
        </span>
      </div>

      {/* Score buckets — full width */}
      <ScoreBucketSection buckets={stats.scoreBuckets} />

      {/* Direction + Pair — side by side */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SegmentCard title="Direction Breakdown" segments={stats.directionStats} />
        <SegmentCard title="Pair Breakdown" segments={stats.pairStats} />
      </div>

      {/* Exit distribution */}
      <ExitDistSection buckets={stats.exitBuckets} />

      {/* Macro context */}
      <MacroSection
        fgZones={stats.fgZones}
        counterTrendStats={stats.counterTrendStats}
        avgRMultiple={stats.avgRMultiple}
        positiveRCount={stats.positiveRCount}
        positiveRPct={stats.positiveRPct}
        totalTrades={stats.totalTrades}
      />
    </div>
  );
}
