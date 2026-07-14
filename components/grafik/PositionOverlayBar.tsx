"use client";

import { usePositionStore } from "@/lib/store/positionStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { computeLiveUpl, computeRoe } from "@/lib/sizer/position-pnl";
import { formatPrice, formatPercent } from "@/lib/i18n/format";

interface Props {
  pair: string;
}

export function PositionOverlayBar({ pair }: Props): React.ReactElement | null {
  const position = usePositionStore(
    (s) => s.positions.find((p) => p.pair === pair && p.direction !== "NEUTRAL") ?? null,
  );
  const livePrice = useMarketStore((s) => s.prices[pair]?.last ?? null);
  const locale = useSettingsStore((s) => s.locale);

  if (!position || livePrice === null) return null;

  const upl = computeLiveUpl(position, livePrice);
  const roe = computeRoe(position, livePrice);
  const isLong = position.direction === "LONG";
  const uplPositive = upl >= 0;
  const uplColor = uplPositive ? "text-signal-green" : "text-signal-red";

  return (
    <div
      className={[
        "flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-xs",
        "w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
        isLong
          ? "border-signal-green/30 bg-signal-green/5"
          : "border-signal-red/30 bg-signal-red/5",
      ].join(" ")}
    >
      <span
        className={`shrink-0 text-[10px] font-bold uppercase tracking-widest ${isLong ? "text-signal-green" : "text-signal-red"}`}
      >
        {isLong ? "▲ LONG" : "▼ SHORT"}
      </span>

      <span className="shrink-0 text-text-t4">·</span>

      <span className="shrink-0 text-text-t3">Entry</span>
      <span className="shrink-0 tabular-nums text-text-t1">
        {formatPrice(position.entryPx, locale)}
      </span>

      <span className="shrink-0 text-text-t4">·</span>

      <span className={`shrink-0 tabular-nums font-bold ${uplColor}`}>
        {formatPrice(upl, locale, true)}
      </span>
      <span className={`shrink-0 tabular-nums ${uplColor}`}>
        {formatPercent(roe, locale, true)}
      </span>

      <span className="shrink-0 text-text-t4">·</span>

      <span className="shrink-0 text-text-t3">{position.leverage}×</span>

      <span className="ml-auto shrink-0 tabular-nums text-[10px] text-text-t4">
        {position.size} {position.pair}
      </span>
    </div>
  );
}
