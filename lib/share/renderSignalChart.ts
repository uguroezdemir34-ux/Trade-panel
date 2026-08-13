/**
 * GO SİNYALİ GRAFİĞİ — mum + S/R çizgileri + trend çizgisi (+ VIP'te
 * Entry/Stop/TP1/TP2 seviyeleri), sabit 1080×1350 kartı doğrudan Canvas 2D
 * API'siyle çizer.
 *
 * lib/share/renderScenarioChart.ts'in "tek çizim kodu, iki çağıran" DESENİ
 * REFERANS ALINDI (priceToY/mum çizimi/S-R çizgisi mantığı) — o dosyadaki
 * priceToY/mum döngüsü/drawSrLine hiçbiri export edilmemiş, renderScenarioChart()
 * fonksiyonunun İÇİNDE kapalı (closure) olarak tanımlı, bu yüzden import
 * EDİLEMEDİ (görev notundaki "olmuyorsa aynı deseni kopyala" — kod
 * tekrarını azaltmak için SADECE sabitler/renkler/font/roundRectPath
 * renderShareCard.ts'ten AYNEN kopyalanan renderScenarioChart.ts ile
 * tutarlı tutuldu, kopya bir "üçüncü tasarım dili" yaratmadı).
 *
 * renderShareCard.ts'e (İSTATİSTİK kartı, mum grafiği YOK) HİÇ dokunulmadı
 * ve buradan hiç import edilmedi — kullanıcı talimatı, iki dosya farklı
 * amaçlar.
 *
 * VİP/PUBLIC AYRIMI (metin tarafındaki AYNI kural, görsele de uygulanıyor
 * — bkz. lib/notify/telegram/formatter.ts formatHumanCheckNumbers()):
 * `data.tradeLevels` sağlanmışsa (VIP) Entry/Stop/TP1/TP2 yatay çizgileri
 * çizilir; sağlanmamışsa (public, undefined) hiç çizilmez — "TP/SL/giriş
 * = İŞLEM TALİMATI, public'e hiç gitmez" kuralı görselde de korunuyor.
 */

import type { Candle } from "@/types/candle";
import type { SrLevels } from "@/lib/sr/detect";
import type { TrendLineResult } from "@/lib/sr/trendLines";
import type { ShareCanvasContext } from "./renderShareCard";
import { CARD_FONT_FAMILY } from "./fontConstants";

export const SIGNAL_CHART_WIDTH = 1080;
export const SIGNAL_CHART_HEIGHT = 1350; // renderScenarioChart.ts ile AYNI oran — görsel tutarlılık

export interface SignalChartTradeLevels {
  entry: number;
  stopPrice: number | null;
  tp1Price: number | null;
  tp2Price: number | null;
}

export interface SignalChartData {
  pair: string;
  direction: "LONG" | "SHORT";
  /** ~40-50 4H mum önerilir (renderScenarioChart.ts ile AYNI konvansiyon).
   *  SLICE/FİLTRE burada YAPILMAZ, çağıranın sorumluluğu. trendLine.p1/p2/
   *  confirmingPoint'in idx değerleri BU DİZİNİN indeksleridir — trendLine
   *  başka bir mum dizisinden hesaplanmışsa çizgi YANLIŞ yerde görünür,
   *  çağıran ikisini AYNI diziden türetmeli (bkz. lib/share/signalChartData.ts).
   */
  candles: Candle[];
  currentPrice: number;
  srLevels: SrLevels;
  /** null ise (yetersiz swing noktası) trend çizgisi hiç çizilmez, hata
   *  vermez — sadece S/R ile devam edilir. */
  trendLine: TrendLineResult | null;
  score: number;
  /** VIP → sağlanır (Entry/Stop/TP1/TP2 çizilir). Public → undefined
   *  (hiç çizilmez) — bkz. dosya başı yorumu. */
  tradeLevels?: SignalChartTradeLevels;
}

// renderShareCard.ts / renderScenarioChart.ts'ten AYNEN kopyalanan
// sabitler/renkler (görsel tutarlılık, üçüncü bir tasarım dili yaratmamak
// için).
const PAD = 56;
const W = SIGNAL_CHART_WIDTH;
const H = SIGNAL_CHART_HEIGHT;

const CARD_FONT = `"${CARD_FONT_FAMILY}", ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace`;

function font(size: number, weight = 400): string {
  return `${weight} ${size}px ${CARD_FONT}`;
}

const BULL_COLOR = "#3ee97d";
const BEAR_COLOR = "#ff3b3b";
const TREND_LINE_COLOR = "#5ab8ff"; // S/R'dan (kırmızı/yeşil) ayrışsın diye mavi
const ENTRY_COLOR = "#f4f6fa";
const STOP_COLOR = "#ff3b3b";
const TP_COLOR = "#3ee97d";

const DIRECTION_ICON: Record<"LONG" | "SHORT", string> = { LONG: "▲", SHORT: "▼" };
const DIRECTION_COLOR: Record<"LONG" | "SHORT", string> = { LONG: "#6ee89a", SHORT: "#f08080" };

export function renderSignalChart(ctx: ShareCanvasContext, data: SignalChartData): void {
  const { pair, direction, candles, srLevels, trendLine, tradeLevels } = data;

  // ── Arka plan — renderShareCard.ts/renderScenarioChart.ts ile AYNI gradient ──
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0c14");
  bg.addColorStop(0.55, "#12141f");
  bg.addColorStop(1, "#090a10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "alphabetic";

  // ── Header: pair + yön + "4H" etiketi ──
  ctx.textAlign = "left";
  ctx.fillStyle = "#e8eaf4";
  ctx.font = font(40, 800);
  ctx.fillText(pair, PAD, PAD + 40);
  const pairWidth = ctx.measureText(pair).width;

  ctx.font = font(28);
  ctx.fillStyle = DIRECTION_COLOR[direction];
  ctx.fillText(`${DIRECTION_ICON[direction]} ${direction}`, PAD + pairWidth + 16, PAD + 40);

  ctx.textAlign = "right";
  ctx.font = font(20);
  ctx.fillStyle = "#8890a4";
  ctx.fillText("4H", W - PAD, PAD + 40);

  // ── Grafik alanı: mumlar + S/R + trend çizgisi (+ VIP trade seviyeleri) ──
  const chartTop = PAD + 90;
  const chartBottom = H - PAD - 70;
  const chartLeft = PAD;
  const chartRight = W - PAD - 130; // sağda seviye etiketleri için boşluk
  const chartHeight = chartBottom - chartTop;
  const chartWidth = chartRight - chartLeft;

  if (candles.length > 0) {
    let minPrice = Math.min(...candles.map((c) => c.l));
    let maxPrice = Math.max(...candles.map((c) => c.h));
    if (srLevels.nearest_resistance) maxPrice = Math.max(maxPrice, srLevels.nearest_resistance.price);
    if (srLevels.nearest_support) minPrice = Math.min(minPrice, srLevels.nearest_support.price);
    if (trendLine) {
      maxPrice = Math.max(maxPrice, trendLine.currentProjectedPrice, trendLine.p1.price, trendLine.p2.price);
      minPrice = Math.min(minPrice, trendLine.currentProjectedPrice, trendLine.p1.price, trendLine.p2.price);
    }
    if (tradeLevels) {
      const levelPrices = [tradeLevels.entry, tradeLevels.stopPrice, tradeLevels.tp1Price, tradeLevels.tp2Price].filter(
        (p): p is number => p !== null,
      );
      if (levelPrices.length > 0) {
        maxPrice = Math.max(maxPrice, ...levelPrices);
        minPrice = Math.min(minPrice, ...levelPrices);
      }
    }
    const pricePad = (maxPrice - minPrice) * 0.08 || maxPrice * 0.01 || 1;
    minPrice -= pricePad;
    maxPrice += pricePad;
    const priceRange = maxPrice - minPrice || 1;

    const priceToY = (price: number): number => chartBottom - ((price - minPrice) / priceRange) * chartHeight;
    const slot = chartWidth / candles.length;
    const xForIdx = (idx: number): number => chartLeft + slot * idx + slot / 2;

    // ── Mumlar ──
    const bodyWidth = Math.max(2, slot * 0.6);
    candles.forEach((c, i) => {
      const cx = xForIdx(i);
      const bullish = c.c >= c.o;
      const color = bullish ? BULL_COLOR : BEAR_COLOR;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, priceToY(c.h));
      ctx.lineTo(cx, priceToY(c.l));
      ctx.stroke();

      const bodyTop = priceToY(Math.max(c.o, c.c));
      const bodyBottom = priceToY(Math.min(c.o, c.c));
      const bodyHeight = Math.max(2, bodyBottom - bodyTop);
      ctx.fillStyle = color;
      ctx.fillRect(cx - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    });

    // ── S/R çizgileri — en yakın ikisi (renderScenarioChart.ts ile AYNI desen) ──
    function drawSrLine(price: number, label: string, color: string): void {
      const y = priceToY(price);
      ctx.save();
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = "left";
      ctx.font = font(18, 600);
      ctx.fillStyle = color;
      ctx.fillText(`${label} $${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`, chartRight + 10, y + 6);
    }

    if (srLevels.nearest_resistance) drawSrLine(srLevels.nearest_resistance.price, "R", BEAR_COLOR);
    if (srLevels.nearest_support) drawSrLine(srLevels.nearest_support.price, "S", BULL_COLOR);

    // ── Trend çizgisi — YOKSA (null) hiç çizilmez, hata vermez ──
    if (trendLine) {
      const x1 = xForIdx(trendLine.p1.idx);
      const y1 = priceToY(trendLine.p1.price);
      const lastIdx = candles.length - 1;
      const x2 = xForIdx(lastIdx);
      const y2 = priceToY(trendLine.currentProjectedPrice);

      ctx.save();
      ctx.strokeStyle = TREND_LINE_COLOR;
      ctx.lineWidth = trendLine.confirmed ? 3 : 2;
      // Teyitsizse (sadece 2 nokta) kesikli — teyitliden görsel olarak
      // AYIRT EDİLSİN, güven seviyesi tek bakışta anlaşılsın.
      if (!trendLine.confirmed) ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      // Teyit noktası varsa küçük bir daire işareti
      if (trendLine.confirmingPoint) {
        const ccx = xForIdx(trendLine.confirmingPoint.idx);
        const ccy = priceToY(trendLine.confirmingPoint.price);
        ctx.save();
        ctx.fillStyle = TREND_LINE_COLOR;
        ctx.beginPath();
        ctx.arc(ccx, ccy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.textAlign = "left";
      ctx.font = font(16, 600);
      ctx.fillStyle = TREND_LINE_COLOR;
      const trendLabel = trendLine.direction === "LONG" ? "Trend (destek)" : "Trend (direnç)";
      ctx.fillText(
        `${trendLabel}${trendLine.confirmed ? " ✓" : ""}`,
        chartLeft + 8,
        priceToY(trendLine.p1.price) - 8,
      );
    }

    // ── VIP — Entry/Stop/TP1/TP2 (public'te tradeLevels undefined, hiç çizilmez) ──
    if (tradeLevels) {
      function drawTradeLevel(price: number | null, label: string, color: string): void {
        if (price === null) return;
        const y = priceToY(price);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(chartRight, y);
        ctx.stroke();
        ctx.restore();

        ctx.textAlign = "right";
        ctx.font = font(16, 700);
        ctx.fillStyle = color;
        ctx.fillText(`${label} $${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`, chartRight, y - 6);
      }
      drawTradeLevel(tradeLevels.entry, "Entry", ENTRY_COLOR);
      drawTradeLevel(tradeLevels.stopPrice, "Stop", STOP_COLOR);
      drawTradeLevel(tradeLevels.tp1Price, "TP1", TP_COLOR);
      drawTradeLevel(tradeLevels.tp2Price, "TP2", TP_COLOR);
    }
  }

  // ── Footer: uyarı — renderShareCard.ts/renderScenarioChart.ts ile AYNI stil ──
  const footerY = H - PAD - 20;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, footerY - 32);
  ctx.lineTo(W - PAD, footerY - 32);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = font(18, 600);
  ctx.fillStyle = "#f0a850";
  ctx.fillText("Not investment advice", PAD, footerY);
}
