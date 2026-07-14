"use client";

/**
 * MARKET RIBBON — War Room overlay'inin A bileşeni.
 *
 * BTC/ETH (marketStore, zaten useMarketStream ile canlı) + DXY
 * (equityIndexStore.uup, useEquityIndexPoller ile besleniyor) anlık
 * fiyat + %chg + EQUITY (accountStore.balanceTotal/dailyPnlPct,
 * useBalancePoller ile besleniyor — "equity" burada hesap bakiyesi,
 * equityIndexStore'daki ABD endeksleriyle KARIŞTIRILMASIN, farklı
 * kavramlar). Yeni veri aboneliği yok — sadece mevcut store'ları okur.
 * Snapshot yoksa (poller henüz dönmedi) o öğe render edilmez.
 *
 * Değişim renkleri: proje genelindeki text-signal-up/down token'ları
 * yerine Faz 1.5'in score-band paletinden (lib/ui/scoreColor.ts BANDS)
 * ödünç alınan doygun hex değerleri (#3ee97d / #ff3b3b) kullanılıyor —
 * fonksiyonel bir bağımlılık DEĞİL, sadece War Room'un HUD görsel
 * dilinde (AdvancedPositionCard'ın emerald/red paletiyle) tutarlılık
 * için sabit string olarak buraya kopyalandı.
 */

import { useMarketStore } from "@/lib/store/marketStore";
import { useEquityIndexStore } from "@/lib/store/equityIndexStore";
import { useAccountStore } from "@/lib/store/accountStore";
import { useLocale } from "@/lib/i18n/context";
import { formatTickPrice, formatPercent, formatPrice } from "@/lib/i18n/format";

const UP_COLOR = "#3ee97d";
const DOWN_COLOR = "#ff3b3b";

function chgStyle(value: number): React.CSSProperties {
  const color = value >= 0 ? UP_COLOR : DOWN_COLOR;
  return { color, filter: `drop-shadow(0 0 3px ${color}80)` };
}

export function MarketRibbon(): React.ReactElement {
  const btc = useMarketStore((s) => s.prices.BTC);
  const eth = useMarketStore((s) => s.prices.ETH);
  const dxy = useEquityIndexStore((s) => s.uup);
  const balanceTotal = useAccountStore((s) => s.balanceTotal);
  const dailyPnlPct = useAccountStore((s) => s.dailyPnlPct);
  const locale = useLocale();

  return (
    <div className="flex items-center gap-4 rounded border border-border/50 bg-surface-s1 px-3 py-1.5 font-mono text-2xs overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      {btc && (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="font-bold text-text-t2">BTC</span>
          <span className="whitespace-nowrap text-sm font-bold tabular-nums text-text-t1">
            {formatTickPrice(btc.last, locale)}
          </span>
          <span className="whitespace-nowrap font-bold" style={chgStyle(btc.chg)}>
            {btc.chg >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(btc.chg), locale)}
          </span>
        </span>
      )}
      {eth && (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="font-bold text-text-t2">ETH</span>
          <span className="whitespace-nowrap text-sm font-bold tabular-nums text-text-t1">
            {formatTickPrice(eth.last, locale)}
          </span>
          <span className="whitespace-nowrap font-bold" style={chgStyle(eth.chg)}>
            {eth.chg >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(eth.chg), locale)}
          </span>
        </span>
      )}
      {dxy && (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="font-bold text-text-t2">DXY</span>
          <span className="tabular-nums text-text-t1">{formatTickPrice(dxy.price, locale)}</span>
          {dxy.changePct !== null && (
            <span className="whitespace-nowrap font-bold" style={chgStyle(dxy.changePct)}>
              {dxy.changePct >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(dxy.changePct), locale)}
            </span>
          )}
        </span>
      )}
      {balanceTotal > 0 && (
        <span className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-border/50 pl-3">
          <span className="font-bold text-text-t2">EQUITY</span>
          <span className="whitespace-nowrap text-sm font-bold tabular-nums text-text-t1">
            {formatPrice(balanceTotal, locale)}
          </span>
          <span className="whitespace-nowrap font-bold" style={chgStyle(dailyPnlPct)}>
            {dailyPnlPct >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(dailyPnlPct), locale)}
          </span>
        </span>
      )}
    </div>
  );
}
