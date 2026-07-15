"use client";

/**
 * POSITION OVERLAY BAR — grafiğin üstünde sabit, tek satırlık pozisyon özeti.
 *
 * Önceden sade bir özetti; AdvancedPositionCard'ın (chart canvas'ının
 * içinde absolute konumlu, floating kart) grafikten kaldırılmasıyla artık
 * TEK pozisyon göstergesi bu — bu yüzden güçlendirildi (daha büyük yazı,
 * Liq eklendi). AdvancedPositionCard neden kaldırıldı: sabit piksel köşesi
 * (önce sağ üst, sonra sol üst) fiyat hareket ettikçe er ya da geç yine
 * mumların üzerine biniyordu — "boş köşe bul" heuristiği yapısal olarak
 * kalıcı değil. Bu bar ise normal doküman akışında (chart canvas'ının
 * DIŞINDA) render ediliyor, hiçbir zaman muma binemez. AdvancedPositionCard
 * dosyası silinmedi (kullanılmıyor, ama duruyor).
 *
 * Sıra (görev talimatındaki örnekle birebir): LONG/SHORT rozeti · PnL $/% ·
 * Entry · Liq · Size · kaldıraç (en sağda, ml-auto).
 */

import { usePositionStore } from "@/lib/store/positionStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { computeLiveUpl, computeRoe } from "@/lib/sizer/position-pnl";
import { formatPrice, formatPercent, formatCoinAmount } from "@/lib/i18n/format";

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
        "flex items-center gap-2 rounded border px-3 py-2 font-mono text-sm",
        "w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
        isLong
          ? "border-signal-green/30 bg-signal-green/5"
          : "border-signal-red/30 bg-signal-red/5",
      ].join(" ")}
    >
      <span
        className={`shrink-0 text-xs font-bold uppercase tracking-widest ${isLong ? "text-signal-green" : "text-signal-red"}`}
      >
        {isLong ? "▲ LONG" : "▼ SHORT"}
      </span>

      <span className="shrink-0 text-text-t4">·</span>

      <span className={`shrink-0 tabular-nums font-bold ${uplColor}`}>
        {formatPrice(upl, locale, true)}
      </span>
      <span className={`shrink-0 tabular-nums font-bold ${uplColor}`}>
        {formatPercent(roe, locale, true)}
      </span>

      <span className="shrink-0 text-text-t4">·</span>

      <span className="shrink-0 text-text-t3">Entry</span>
      <span className="shrink-0 tabular-nums text-text-t1">
        {formatPrice(position.entryPx, locale)}
      </span>

      {position.liqPx !== null && (
        <>
          <span className="shrink-0 text-text-t4">·</span>
          <span className="shrink-0 text-signal-red/80">Liq</span>
          <span className="shrink-0 tabular-nums text-signal-red/80">
            {formatPrice(position.liqPx, locale)}
          </span>
        </>
      )}

      <span className="shrink-0 text-text-t4">·</span>

      <span className="shrink-0 tabular-nums text-text-t3">
        {formatCoinAmount(position.size, position.pair, locale)}
      </span>

      <span className="ml-auto shrink-0 tabular-nums text-xs text-text-t4">{position.leverage}×</span>
    </div>
  );
}
