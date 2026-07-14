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
  const theme = useSettingsStore((s) => s.theme);

  if (!position || livePrice === null) return null;

  const upl = computeLiveUpl(position, livePrice);
  const roe = computeRoe(position, livePrice);
  const isLong = position.direction === "LONG";
  const isProfit = upl >= 0;
  // Light temada bg-border/60 token'ı chart'ın açık arkaplanına karşı
  // çok soluk kalıyordu — literal gri sınır + daha belirgin gölge ile
  // değiştirildi (ScoreRingV2'deki isDark deseniyle aynı: theme JS'te
  // okunup koşullu class seçiliyor, Tailwind'in dark: variant'ı bu
  // projede darkMode config'i olmadığı için kullanılmıyor).
  const cardBorderShadow =
    theme === "light"
      ? "border-slate-300 shadow-md"
      : "border-border/60 shadow-lg";

  return (
    <div className={`pointer-events-auto flex flex-col gap-1.5 rounded-lg border ${cardBorderShadow} bg-bg-card/60 px-3 py-2.5 font-mono backdrop-blur-sm`}>
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

      {/* PnL — HUD odak noktası (text-4xl → text-2xl: kart artık grafiğin
          kendisini daha az eziyor, bkz. görev raporu) */}
      <div
        className={`rounded-lg px-3 py-1.5 text-center ${
          isProfit ? "bg-emerald-500/10" : "bg-red-500/10"
        }`}
      >
        <div
          className={`whitespace-nowrap text-2xl font-black leading-none tabular-nums ${
            isProfit ? "text-emerald-400" : "text-red-500"
          }`}
        >
          {formatPrice(upl, locale, true)}
        </div>
        {/* mt-1 → mt-2: text-2xl font-black + leading-none üstteki rakamın
            görsel alt kenarını çok sıkı bırakıyordu, % satırıyla neredeyse
            değiyordu (özellikle light temada, ekran görüntüsünde teyit
            edildi) — boşluk iki katına çıkarıldı. */}
        <div
          className={`mt-2 whitespace-nowrap text-sm font-bold tabular-nums ${
            isProfit ? "text-emerald-400" : "text-red-500"
          }`}
        >
          {formatPercent(roe, locale, true)}
        </div>
      </div>

      {/* Entry / Liq / Size — dashboard grid.
          NOT: değer text'leri önceden hardcoded text-white idi — light
          temada açık bg-surface-s2 arkaplana karşı neredeyse görünmez
          oluyordu. text-text-t1 (tema-farkında token, projenin geri
          kalanında zaten kullanılıyor) ile değiştirildi — gerçek kontrast
          düzeltmesi bu, sadece kenarlık/gölge eklemek yetmezdi. */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className={`rounded border ${theme === "light" ? "border-slate-300" : "border-border/50"} bg-surface-s2 px-1.5 py-1 text-center`}>
          <div className="whitespace-nowrap text-[9px] uppercase tracking-wider text-text-t4">Entry</div>
          <div className="whitespace-nowrap text-lg font-bold tabular-nums text-text-t1">
            {formatPrice(position.entryPx, locale)}
          </div>
        </div>

        {position.liqPx !== null && (
          <div className="rounded border border-red-500/50 bg-red-500/5 px-1.5 py-1 text-center">
            <div className="whitespace-nowrap text-[9px] uppercase tracking-wider text-red-400">Liq</div>
            <div className="whitespace-nowrap text-lg font-bold tabular-nums text-red-400">
              {formatPrice(position.liqPx, locale)}
            </div>
          </div>
        )}

        <div className={`rounded border ${theme === "light" ? "border-slate-300" : "border-border/50"} bg-surface-s2 px-1.5 py-1 text-center`}>
          <div className="whitespace-nowrap text-[9px] uppercase tracking-wider text-text-t4">Size</div>
          <div className="whitespace-nowrap text-lg font-bold tabular-nums text-text-t1">
            {position.size}
          </div>
        </div>
      </div>
    </div>
  );
}
