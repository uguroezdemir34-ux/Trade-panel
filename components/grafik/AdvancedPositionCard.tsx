"use client";

/**
 * ADVANCED POSITION CARD — War Room overlay'inin B bileşeni.
 *
 * Grafiğin sağ üst köşesine absolute yerleşen, salt-okunur portföy kartı.
 * PositionOverlayBar ile aynı veri kaynağını (positionStore + marketStore +
 * lib/sizer/position-pnl) kullanır, ayrıca position.liqPx gösterir.
 * Emir gönderme / TP-SL / Market Exit YOK — %100 read-only.
 *
 * Pointer-events: kartın kendisi konteynerinin (grafik sarmalayıcısı)
 * pointer-events-none olduğu varsayımıyla çağrılır — bu bileşen kendi
 * kökünde pointer-events-auto ile yalnız kendi alanını etkileşimli yapar,
 * Lightweight Charts'ın pan/zoom/crosshair'ini bloklamaz.
 */

import { usePositionStore } from "@/lib/store/positionStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { computeLiveUpl, computeRoe } from "@/lib/sizer/position-pnl";
import { formatPrice, formatPercent } from "@/lib/i18n/format";

interface Props {
  pair: string;
}

export function AdvancedPositionCard({ pair }: Props): React.ReactElement | null {
  const position = usePositionStore(
    (s) => s.positions.find((p) => p.pair === pair && p.direction !== "NEUTRAL") ?? null,
  );
  const livePrice = useMarketStore((s) => s.prices[pair]?.last ?? null);
  const locale = useSettingsStore((s) => s.locale);

  if (!position || livePrice === null) return null;

  const upl = computeLiveUpl(position, livePrice);
  const roe = computeRoe(position, livePrice);
  const isLong = position.direction === "LONG";
  const uplColor = upl >= 0 ? "text-signal-green" : "text-signal-red";
  const dirColor = isLong ? "border-signal-green/40 bg-signal-green/5" : "border-signal-red/40 bg-signal-red/5";

  return (
    <div
      className={`pointer-events-auto flex flex-col gap-1 rounded-lg border px-3 py-2 font-mono text-2xs backdrop-blur-sm bg-bg-card/90 shadow-lg ${dirColor}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`font-bold uppercase tracking-widest text-[10px] ${isLong ? "text-signal-green" : "text-signal-red"}`}>
          {isLong ? "▲ LONG" : "▼ SHORT"}
        </span>
        <span className="text-text-t4">·</span>
        <span className="text-text-t3">{position.leverage}×</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-text-t3">Entry</span>
        <span className="tabular-nums text-text-t1">{formatPrice(position.entryPx, locale)}</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-text-t3">PnL</span>
        <span className={`tabular-nums font-bold ${uplColor}`}>
          {formatPrice(upl, locale, true)} ({formatPercent(roe, locale, true)})
        </span>
      </div>

      {position.liqPx !== null && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-text-t3">Liq</span>
          <span className="tabular-nums text-signal-red">{formatPrice(position.liqPx, locale)}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-text-t3">Size</span>
        <span className="tabular-nums text-text-t4">{position.size} {position.pair}</span>
      </div>
    </div>
  );
}
