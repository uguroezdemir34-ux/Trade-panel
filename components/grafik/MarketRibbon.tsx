"use client";

/**
 * MARKET RIBBON — War Room overlay'inin A bileşeni.
 *
 * BTC/ETH (marketStore, zaten useMarketStream ile canlı) + DXY
 * (equityIndexStore.uup, useEquityIndexPoller ile besleniyor) anlık
 * fiyat + %chg. Yeni veri aboneliği yok — sadece mevcut store'ları okur.
 * Snapshot yoksa (poller henüz dönmedi) o öğe render edilmez.
 */

import { useMarketStore } from "@/lib/store/marketStore";
import { useEquityIndexStore } from "@/lib/store/equityIndexStore";
import { useLocale } from "@/lib/i18n/context";
import { formatTickPrice, formatPercent } from "@/lib/i18n/format";

export function MarketRibbon(): React.ReactElement {
  const btc = useMarketStore((s) => s.prices.BTC);
  const eth = useMarketStore((s) => s.prices.ETH);
  const dxy = useEquityIndexStore((s) => s.uup);
  const locale = useLocale();

  return (
    <div className="flex items-center gap-4 rounded border border-border/50 bg-surface-s1 px-3 py-1.5 font-mono text-2xs overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      {btc && (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="font-bold text-text-t2">BTC</span>
          <span className="tabular-nums text-text-t1">{formatTickPrice(btc.last, locale)}</span>
          <span className={btc.chg >= 0 ? "text-signal-up" : "text-signal-down"}>
            {btc.chg >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(btc.chg), locale)}
          </span>
        </span>
      )}
      {eth && (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="font-bold text-text-t2">ETH</span>
          <span className="tabular-nums text-text-t1">{formatTickPrice(eth.last, locale)}</span>
          <span className={eth.chg >= 0 ? "text-signal-up" : "text-signal-down"}>
            {eth.chg >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(eth.chg), locale)}
          </span>
        </span>
      )}
      {dxy && (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="font-bold text-text-t2">DXY</span>
          <span className="tabular-nums text-text-t1">{formatTickPrice(dxy.price, locale)}</span>
          {dxy.changePct !== null && (
            <span className={dxy.changePct >= 0 ? "text-signal-up" : "text-signal-down"}>
              {dxy.changePct >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(dxy.changePct), locale)}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
