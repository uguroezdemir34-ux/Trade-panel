"use client";

/**
 * FLOW ALIGNMENT ROW — Karar kartında "🧠 FLOW INTELLIGENCE" satırı.
 *
 * Collapsed: tek satır özet + adjustment + confidence multiplier
 * Expanded drilldown:
 *   - Smart Money (VPIN)
 *   - Volume Delta — 1m / 5m / 15m çoklu pencere
 *   - Delta Divergence
 *   - SMC son event
 *   - Liq Magnet — gerçek fiyatlar + intensity
 *   - Borsa feed özeti (OKX / Binance / Bybit event sayısı)
 */

import { useState, useMemo } from "react";
import type { FlowIntelligenceResult } from "@/lib/orderflow/flowIntelligence";
import type { LiquidationMap } from "@/lib/orderflow/liquidationMap";
import { useLiqFeedStore } from "@/lib/store/liqFeedStore";
import type { LiqEvent } from "@/lib/store/liqFeedStore";
import { useT } from "@/lib/i18n/context";

const EMPTY_LIQ_EVENTS: LiqEvent[] = [];

interface Props {
  flow: FlowIntelligenceResult | null;
}

export function FlowAlignmentRow({ flow }: Props) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  // Exchange feed counts — only subscribed when expanded to avoid wasted renders
  const allEvents = useLiqFeedStore((s) => (flow ? (s.events[flow.pair] ?? EMPTY_LIQ_EVENTS) : EMPTY_LIQ_EVENTS));
  const exchangeCounts = useMemo(() => {
    const counts = { okx: 0, binance: 0, bybit: 0, unknown: 0 };
    for (const e of allEvents) {
      const ex = e.exchange ?? "unknown";
      if (ex === "okx") counts.okx++;
      else if (ex === "binance") counts.binance++;
      else if (ex === "bybit") counts.bybit++;
      else counts.unknown++;
    }
    return counts;
  }, [allEvents]);

  const totalFeedEvents = allEvents.length;

  if (!flow) {
    return (
      <div className="bg-surface-s2 rounded-md p-3 text-text-t3 text-xs">
        {t("karar.flowPreparing")}
      </div>
    );
  }

  const colorClass = flow.vetoed
    ? "text-signal-down"
    : flow.totalAdjustment > 5
    ? "text-signal-up"
    : flow.totalAdjustment > 0
    ? "text-warning"
    : flow.totalAdjustment < -5
    ? "text-signal-down"
    : flow.totalAdjustment < 0
    ? "text-warning"
    : "text-text-t3";

  const icon = flow.vetoed ? "⚠" : flow.totalAdjustment > 0 ? "✓" : flow.totalAdjustment < 0 ? "⚠" : "○";
  const adjustmentText = flow.totalAdjustment > 0 ? `+${flow.totalAdjustment}` : `${flow.totalAdjustment}`;
  const multText = `×${flow.confidenceMultiplier.toFixed(2)}`;
  const multColor =
    flow.confidenceMultiplier > 1.15
      ? "text-signal-up"
      : flow.confidenceMultiplier < 0.85
      ? "text-signal-down"
      : "text-text-t4";

  // Feed source indicator: REAL if ≥20 events, EST if OHLCV fallback
  const feedLabel = totalFeedEvents >= 20 ? "REAL" : "EST";
  const feedLabelColor = totalFeedEvents >= 20 ? "text-signal-up" : "text-text-t4";

  return (
    <div
      className="bg-surface-s2 hover:bg-surface-s3 rounded-md transition-colors"
      data-testid="flow-alignment-row"
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-3 text-left flex items-center justify-between gap-2"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flow-led shrink-0 w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: flow.vetoed || flow.totalAdjustment < -5
                ? "#ef4444"
                : flow.totalAdjustment > 5
                ? "#22c55e"
                : "#f59e0b",
              ["--led-color" as string]: flow.vetoed || flow.totalAdjustment < -5
                ? "rgb(239 68 68 / 0.7)"
                : flow.totalAdjustment > 5
                ? "rgb(34 197 94 / 0.7)"
                : "rgb(245 158 11 / 0.7)",
            }}
          />
          <span className="text-text-t2 text-xs font-medium shrink-0">FLOW</span>
          <span className={`${colorClass} text-xs font-medium truncate`}>
            {icon} {flow.humanSummary}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`${feedLabelColor} text-[10px] font-mono`}>{feedLabel}</span>
          <span className={`${multColor} text-[10px] font-mono tabular-nums`}>{multText}</span>
          <span className={`${colorClass} text-xs font-mono font-bold tabular-nums`} data-testid="flow-adjustment">
            {adjustmentText}
          </span>
          <span className="text-text-t4 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-1.5" data-testid="flow-drilldown">

          {/* SMC son event */}
          {flow.smc.recentEvents.length > 0 && (
            <DetailRow
              label="SMC"
              value={flow.smc.recentEvents[0].label}
              tone={flow.smc.recentEvents[0].direction === "bullish" ? "up" : "down"}
            />
          )}

          {/* Liq Magnet — gerçek fiyatlar */}
          <LiqSection liqMap={flow.liqMap} />

          {/* VETO banner */}
          {flow.vetoed && (
            <div className="mt-2 p-2 bg-signal-down/10 border border-signal-down/30 rounded text-signal-down text-xs font-medium">
              VETO: {flow.vetoReason}
            </div>
          )}

          {/* Borsa feed özeti */}
          <ExchangeBadgeRow counts={exchangeCounts} total={totalFeedEvents} />
        </div>
      )}
    </div>
  );
}

// ── Liq Magnet section ────────────────────────────────────────────────────────

function LiqSection({ liqMap }: { liqMap: LiquidationMap }) {
  const t = useT();
  const hasData = liqMap.nearestLongLiq !== null || liqMap.nearestShortLiq !== null;
  if (!hasData) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-t4">Liq Magnet</span>
        <span className="text-text-t3 text-[10px]">
          {liqMap.magnetZones.length > 0 ? t("karar.flowMagnetNear").replace("{n}", String(liqMap.magnetZones.length)) : t("karar.flowMagnetFar")}
        </span>
      </div>

      {liqMap.nearestShortLiq && (
        <LiqLevelRow
          label="Short liq ↑"
          level={liqMap.nearestShortLiq}
          tone="down"
        />
      )}
      {liqMap.nearestLongLiq && (
        <LiqLevelRow
          label="Long liq ↓"
          level={liqMap.nearestLongLiq}
          tone="up"
        />
      )}
    </div>
  );
}

interface LiqLevelProps {
  label: string;
  level: { price: number; intensity: number };
  tone: "up" | "down";
}

function LiqLevelRow({ label, level, tone }: LiqLevelProps) {
  const barColor = tone === "up" ? "bg-signal-up" : "bg-signal-down";
  const textColor = tone === "up" ? "text-signal-up" : "text-signal-down";
  const barWidth = `${Math.round(level.intensity * 100)}%`;

  return (
    <div className="flex items-center justify-between text-[11px] gap-2">
      <span className="text-text-t4 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Intensity mini-bar */}
        <div className="w-12 h-1 bg-surface-s3 rounded-full overflow-hidden shrink-0">
          <div className={`h-full ${barColor} opacity-70`} style={{ width: barWidth }} />
        </div>
        <span className={`${textColor} font-mono tabular-nums`}>
          ${level.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

// ── Exchange badge ─────────────────────────────────────────────────────────────

interface ExchangeCounts { okx: number; binance: number; bybit: number; unknown: number }

function ExchangeBadgeRow({ counts, total }: { counts: ExchangeCounts; total: number }) {
  const t = useT();
  if (total === 0) {
    return (
      <div className="pt-1 border-t border-border/50 flex items-center gap-1 text-[10px] text-text-t4 font-mono">
        <span>{t("karar.flowNoEvents")}</span>
      </div>
    );
  }

  return (
    <div className="pt-1 border-t border-border/50 flex items-center gap-1 flex-wrap text-[10px] font-mono">
      <span className="text-text-t4">{t("karar.fundingLabel")}:</span>
      {counts.okx > 0 && (
        <ExBadge label="OKX" count={counts.okx} color="text-blue-400" />
      )}
      {counts.binance > 0 && (
        <ExBadge label="BIN" count={counts.binance} color="text-yellow-400" />
      )}
      {counts.bybit > 0 && (
        <ExBadge label="BBT" count={counts.bybit} color="text-orange-400" />
      )}
      <span className="text-text-t4 ml-auto">{total} events</span>
    </div>
  );
}

function ExBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className={`${color} tabular-nums`}>
      {label} <span className="text-text-t3">{count}</span>
    </span>
  );
}

// ── Generic detail row ─────────────────────────────────────────────────────────

interface DetailRowProps {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
}

function DetailRow({ label, value, tone = "neutral" }: DetailRowProps) {
  const valueColor =
    tone === "up" ? "text-signal-up" : tone === "down" ? "text-signal-down" : "text-text-t2";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-t4">{label}</span>
      <span className={`${valueColor} font-mono tabular-nums`}>{value}</span>
    </div>
  );
}
