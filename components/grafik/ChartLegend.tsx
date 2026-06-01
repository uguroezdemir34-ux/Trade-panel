"use client";

/**
 * CHART LEGEND — Renk açıklamaları.
 */

import { useT } from "@/lib/i18n/context";

interface Props {
  showEma20: boolean;
  showEma50: boolean;
  showEma200: boolean;
  showTrades: boolean;
  showVolume: boolean;
  showRsi: boolean;
  showMacd: boolean;
  showBb: boolean;
}

export function ChartLegend({
  showEma20,
  showEma50,
  showEma200,
  showTrades,
  showVolume,
  showRsi,
  showMacd,
  showBb,
}: Props): React.ReactElement {
  const t = useT();

  return (
    <div className="border-border bg-bg-card flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 font-mono text-2xs tracking-wider">
      <LegendDot color="#22c55e" label={t("grafik.legend.candleUp")} />
      <LegendDot color="#ef4444" label={t("grafik.legend.candleDown")} />
      {showEma20 && <LegendDot color="#3b82f6" label={t("grafik.legend.ema20")} />}
      {showEma50 && <LegendDot color="#f59e0b" label={t("grafik.legend.ema50")} />}
      {showEma200 && <LegendDot color="#a855f7" label={t("grafik.legend.ema200")} dashed />}
      {showTrades && (
        <>
          <LegendArrow up label={t("grafik.legend.tradeLong")} />
          <LegendArrow up={false} label={t("grafik.legend.tradeShort")} />
        </>
      )}
      {showVolume && <LegendBar label={t("grafik.legend.volume")} />}
      {showBb && <LegendDot color="#06b6d4" label={t("grafik.legend.bb")} dashed />}
      {showRsi && <LegendDot color="#ec4899" label={t("grafik.legend.rsi14")} />}
      {showMacd && (
        <>
          <LegendDot color="#3b82f6" label={t("grafik.legend.macdLine")} />
          <LegendDot color="#f59e0b" label={t("grafik.legend.macdSignal")} />
        </>
      )}
    </div>
  );
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-0 w-4"
        style={{
          borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}`,
        }}
      />
      <span className="text-text-t3">{label}</span>
    </div>
  );
}

function LegendArrow({ up, label }: { up: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-text-t1 font-bold">{up ? "▲" : "▼"}</span>
      <span className="text-text-t3">{label}</span>
    </div>
  );
}

function LegendBar({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-3 w-4 items-end gap-px">
        <div className="w-1 rounded-sm" style={{ height: "40%", background: "rgba(239,68,68,0.6)" }} />
        <div className="w-1 rounded-sm" style={{ height: "70%", background: "rgba(34,197,94,0.6)" }} />
        <div className="w-1 rounded-sm" style={{ height: "55%", background: "rgba(34,197,94,0.6)" }} />
        <div className="w-1 rounded-sm" style={{ height: "90%", background: "rgba(34,197,94,0.6)" }} />
      </div>
      <span className="text-text-t3">{label}</span>
    </div>
  );
}
