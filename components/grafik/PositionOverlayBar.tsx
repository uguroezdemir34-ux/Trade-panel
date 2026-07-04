"use client";

import type { Position } from "@/lib/okx/positions";
import { computeLiveUpl, computeRoe } from "@/lib/sizer/position-pnl";
import { formatPrice, formatPercent } from "@/lib/i18n/format";
import { useSettingsStore } from "@/lib/store/settingsStore";

interface Props {
  position: Position;
  livePrice: number;
}

export function PositionOverlayBar({ position, livePrice }: Props): React.ReactElement {
  const locale = useSettingsStore((s) => s.locale);
  const upl = computeLiveUpl(position, livePrice);
  const roe = computeRoe(position, livePrice);

  const isLong = position.direction === "LONG";
  const uplPositive = upl >= 0;
  const uplColor = uplPositive ? "text-signal-green" : "text-signal-red";

  return (
    <div
      className={[
        "flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-xs",
        isLong
          ? "border-signal-green/30 bg-signal-green/5"
          : "border-signal-red/30 bg-signal-red/5",
      ].join(" ")}
    >
      {/* Direction badge */}
      <span
        className={`shrink-0 text-[10px] font-bold uppercase tracking-widest ${isLong ? "text-signal-green" : "text-signal-red"}`}
      >
        {isLong ? "▲ LONG" : "▼ SHORT"}
      </span>

      <span className="shrink-0 text-text-t4">·</span>

      {/* Entry price */}
      <span className="shrink-0 text-text-t3">Entry</span>
      <span className="shrink-0 tabular-nums text-text-t1">
        {formatPrice(position.entryPx, locale)}
      </span>

      <span className="shrink-0 text-text-t4">·</span>

      {/* UPL + ROE */}
      <span className={`shrink-0 tabular-nums font-bold ${uplColor}`}>
        {formatPrice(upl, locale, true)}
      </span>
      <span className={`shrink-0 tabular-nums ${uplColor}`}>
        {formatPercent(roe, locale, true)}
      </span>

      <span className="shrink-0 text-text-t4">·</span>

      {/* Leverage */}
      <span className="shrink-0 text-text-t3">{position.leverage}×</span>

      {/* Size — pushed right */}
      <span className="ml-auto shrink-0 tabular-nums text-[10px] text-text-t4">
        {position.size} {position.pair}
      </span>
    </div>
  );
}
