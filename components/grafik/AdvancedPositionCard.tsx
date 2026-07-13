"use client";

/**
 * ADVANCED POSITION CARD — War Room overlay'inin B bileşeni.
 * "HUD / Car Mode" — PnL büyük ve merkezi odak noktası, Entry/Liq/Size
 * dashboard grid'i, dolgulu LONG/SHORT kapsülü. Proje genelinde kullanılan
 * signal-green/signal-red token'ları yerine standart Tailwind emerald/red
 * paleti kullanılıyor (bilinçli, sadece bu HUD component'i için — görev
 * kararı, tailwind.config.ts'teki `extend.colors` varsayılan paleti
 * kaldırmıyor, sadece üzerine ekliyor, bu yüzden emerald/red sınıfları
 * doğrudan kullanılabilir).
 *
 * Genişlik kasıtlı olarak SABİT DEĞİL (orijinal tasarımda da yoktu) —
 * grid hücreleri text-lg değerlere göre doğal olarak genişliyor. Bu,
 * app/grafik/page.tsx'teki wrapper'ın (`absolute top-2 right-16`, sadece
 * `right` set, `left` yok) sağ kenarını SABİT tutması sayesinde güvenli:
 * kart genişledikçe SOLA doğru büyüyor, sağ kenarı (fiyat eksenine en
 * yakın nokta) her zaman aynı 64px payda kalıyor — bkz. page.tsx'teki
 * yorum ve bu görevin raporundaki CSS kutu-modeli açıklaması.
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
  const isProfit = upl >= 0;

  return (
    <div className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-border/60 bg-bg-card/95 px-3 py-3 font-mono shadow-lg backdrop-blur-sm">
      {/* Yön kapsülü + kaldıraç */}
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold text-white ${
            isLong ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          {isLong ? "LONG" : "SHORT"}
        </span>
        <span className="whitespace-nowrap text-xs text-text-t3">{position.leverage}×</span>
      </div>

      {/* PnL — HUD odak noktası */}
      <div
        className={`rounded-lg px-3 py-2 text-center ${
          isProfit ? "bg-emerald-500/10" : "bg-red-500/10"
        }`}
      >
        <div
          className={`whitespace-nowrap text-4xl font-black leading-none tabular-nums ${
            isProfit ? "text-emerald-400" : "text-red-500"
          }`}
        >
          {formatPrice(upl, locale, true)}
        </div>
        <div
          className={`mt-1 whitespace-nowrap text-sm font-bold tabular-nums ${
            isProfit ? "text-emerald-400" : "text-red-500"
          }`}
        >
          {formatPercent(roe, locale, true)}
        </div>
      </div>

      {/* Entry / Liq / Size — dashboard grid */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded border border-border/50 bg-surface-s2 px-1.5 py-1.5 text-center">
          <div className="whitespace-nowrap text-[9px] uppercase tracking-wider text-text-t4">Entry</div>
          <div className="whitespace-nowrap text-lg font-bold tabular-nums text-white">
            {formatPrice(position.entryPx, locale)}
          </div>
        </div>

        {position.liqPx !== null && (
          <div className="rounded border border-red-500/50 bg-red-500/5 px-1.5 py-1.5 text-center">
            <div className="whitespace-nowrap text-[9px] uppercase tracking-wider text-red-400">Liq</div>
            <div className="whitespace-nowrap text-lg font-bold tabular-nums text-red-400">
              {formatPrice(position.liqPx, locale)}
            </div>
          </div>
        )}

        <div className="rounded border border-border/50 bg-surface-s2 px-1.5 py-1.5 text-center">
          <div className="whitespace-nowrap text-[9px] uppercase tracking-wider text-text-t4">Size</div>
          <div className="whitespace-nowrap text-lg font-bold tabular-nums text-white">
            {position.size}
          </div>
        </div>
      </div>
    </div>
  );
}
