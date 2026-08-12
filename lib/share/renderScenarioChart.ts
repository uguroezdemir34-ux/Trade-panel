/**
 * AI SENARYO GRAFİĞİ — mum + S/R çizgileri + skor rozeti, sabit 1080×1350
 * kartı doğrudan Canvas 2D API'siyle çizer. renderShareCard.ts'in "tek
 * çizim kodu, iki çağıran" desenini takip ediyor — bu dosya SAF, hangi
 * ortamda (tarayıcı/sunucu) çalıştığını bilmiyor.
 *
 * VERİ TEKRAR HESAPLANMAZ: candles/srLevels/score DOĞRUDAN çağırandan
 * geliyor (fetchScenarioSRLevels + calculateAIScore'un çıktısı) — bu
 * dosya sadece verileni çiziyor. telegram-format.ts'in caption'ı ile bu
 * grafik AYNI ScenarioChartData kaynağından türüyor (iki farklı görüntüleme,
 * tek veri) — iki yerde ayrı ayrı hesaplama riski yok.
 *
 * lineTo — ShareCanvasContext (renderShareCard.ts) artık bunu deklare
 * ediyor (ayrı bir PR'da eklendi, CI'da doğrulandı) — bu dosya önceden
 * kendi ScenarioCanvasContext extends katmanını tanımlıyordu, artık
 * gereksiz olduğu için kaldırıldı, ShareCanvasContext doğrudan kullanılıyor.
 *
 * Renk paleti, buradaki tüm sabitler renderShareCard.ts'ten (GO sinyal
 * kartı) BİLEREK aynen kopyalandı — görsel kimlik tutarlılığı için (arka
 * plan gradient'i, footer disclaimer rengi/fontu, PAD değeri).
 */

import type { Candle } from "@/types/candle";
import type { SrLevels } from "@/lib/sr/detect";
import type { AIScoreResult } from "@/lib/analysis/score";
import type { ShareCanvasContext } from "./renderShareCard";
import { CARD_FONT_FAMILY } from "./fontConstants";

export const SCENARIO_CHART_WIDTH = 1080;
export const SCENARIO_CHART_HEIGHT = 1350; // 4:5 — Telegram/X'te iyi render eden oran (kare değil, kullanıcı kararı)

export interface ScenarioChartData {
  symbol: string;
  candles: Candle[]; // ~40-50 4H mum — SLICE/FİLTRE burada YAPILMAZ, çağıranın sorumluluğu
  currentPrice: number;
  srLevels: SrLevels;
  score: AIScoreResult;
}

// renderShareCard.ts'ten AYNEN kopyalanan sabitler/renkler (görsel tutarlılık).
const PAD = 56;
const W = SCENARIO_CHART_WIDTH;
const H = SCENARIO_CHART_HEIGHT;

// CARD_FONT_FAMILY artık lib/share/fontConstants.ts'ten import ediliyor (tek
// kaynak, renderShareCard.ts ile paylaşılıyor).
const CARD_FONT = `"${CARD_FONT_FAMILY}", ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace`;

function font(size: number, weight = 400): string {
  return `${weight} ${size}px ${CARD_FONT}`;
}

function roundRectPath(ctx: ShareCanvasContext, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Yön eşikleri — KOPYA, lib/analysis/telegram-format.ts'teki directionLabel()
 * ile AYNI eşikler (>=60 boğa / <=40 ayı / nötr), senkron tutulmalı. Export
 * edilmemiş bir helper olduğu için import edilemedi, buraya da kopyalandı
 * (calcPenalty/score.ts'teki KOPYA deseniyle aynı, kullanıcı onayıyla).
 */
function directionLabel(score: number): string {
  if (score >= 60) return "Boğa eğilimli";
  if (score <= 40) return "Ayı eğilimli";
  return "Nötr";
}

const BULL_COLOR = "#3ee97d"; // VERDICT_SCORE_COLOR.go ile aynı (renderShareCard.ts)
const BEAR_COLOR = "#ff3b3b"; // VERDICT_SCORE_COLOR.no ile aynı

const BADGE_BG: Record<"bull" | "bear" | "neutral", string> = {
  bull: "#0e7030", // VERDICT_COLORS.go.bg ile aynı
  bear: "#9a0e0e", // VERDICT_COLORS.no.bg ile aynı
  neutral: "#9e5a08", // VERDICT_COLORS.wait.bg ile aynı
};

function directionKey(score: number): "bull" | "bear" | "neutral" {
  if (score >= 60) return "bull";
  if (score <= 40) return "bear";
  return "neutral";
}

export function renderScenarioChart(ctx: ShareCanvasContext, data: ScenarioChartData): void {
  const { symbol, candles, currentPrice, srLevels, score } = data;

  // ── 1. Arka plan — renderShareCard.ts'teki AYNI gradient ──
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0c14");
  bg.addColorStop(0.55, "#12141f");
  bg.addColorStop(1, "#090a10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "alphabetic";

  // ── Header: symbol + 4H etiketi (sol), skor rozeti (sağ üst, madde 4) ──
  ctx.textAlign = "left";
  ctx.fillStyle = "#e8eaf4";
  ctx.font = font(40, 800);
  ctx.fillText(symbol, PAD, PAD + 40);
  const symbolWidth = ctx.measureText(symbol).width;
  ctx.font = font(20);
  ctx.fillStyle = "#8890a4";
  ctx.fillText("· 4H", PAD + symbolWidth + 14, PAD + 40);

  const dirKey = directionKey(score.score);
  const badgeLabel = `${Math.round(score.score)}/100 ${directionLabel(score.score)}`;
  ctx.font = font(24, 700);
  const badgeTextWidth = ctx.measureText(badgeLabel).width;
  const badgePadX = 20;
  const badgeH = 48;
  const badgeW = badgeTextWidth + badgePadX * 2;
  const badgeX = W - PAD - badgeW;
  const badgeY = PAD;
  roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fillStyle = BADGE_BG[dirKey];
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = "#f4f6fa";
  ctx.font = font(24, 700);
  ctx.fillText(badgeLabel, badgeX + badgePadX, badgeY + badgeH / 2 + 8);

  // ── 2-3. Grafik alanı: mumlar + S/R çizgileri ──
  const chartTop = PAD + 110;
  const chartBottom = H - PAD - 90;
  const chartLeft = PAD;
  const chartRight = W - PAD - 130; // sağda S/R fiyat etiketleri için boşluk
  const chartHeight = chartBottom - chartTop;
  const chartWidth = chartRight - chartLeft;

  if (candles.length > 0) {
    // Fiyat aralığı — mum high/low'ları + S/R seviyeleri (varsa) dahil,
    // S/R çizgisi grafik dışında kalıp görünmez olmasın diye.
    let minPrice = Math.min(...candles.map((c) => c.l));
    let maxPrice = Math.max(...candles.map((c) => c.h));
    if (srLevels.nearest_resistance) maxPrice = Math.max(maxPrice, srLevels.nearest_resistance.price);
    if (srLevels.nearest_support) minPrice = Math.min(minPrice, srLevels.nearest_support.price);
    const pad = (maxPrice - minPrice) * 0.08 || maxPrice * 0.01 || 1;
    minPrice -= pad;
    maxPrice += pad;
    const priceRange = maxPrice - minPrice || 1;

    const priceToY = (price: number): number => chartBottom - ((price - minPrice) / priceRange) * chartHeight;

    // ── 2. Mumlar ──
    const slot = chartWidth / candles.length;
    const bodyWidth = Math.max(2, slot * 0.6);
    candles.forEach((c, i) => {
      const cx = chartLeft + slot * i + slot / 2;
      const bullish = c.c >= c.o;
      const color = bullish ? BULL_COLOR : BEAR_COLOR;

      // Fitil (moveTo + lineTo + stroke)
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, priceToY(c.h));
      ctx.lineTo(cx, priceToY(c.l));
      ctx.stroke();

      // Gövde (fillRect)
      const bodyTop = priceToY(Math.max(c.o, c.c));
      const bodyBottom = priceToY(Math.min(c.o, c.c));
      const bodyHeight = Math.max(2, bodyBottom - bodyTop); // doji'de en az 2px görünür kalsın
      ctx.fillStyle = color;
      ctx.fillRect(cx - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    });

    // ── 3. S/R çizgileri — sadece en yakın ikisi ──
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
      ctx.fillText(`${label} $${price}`, chartRight + 10, y + 6);
    }

    if (srLevels.nearest_resistance) {
      drawSrLine(srLevels.nearest_resistance.price, "R", BEAR_COLOR);
    }
    if (srLevels.nearest_support) {
      drawSrLine(srLevels.nearest_support.price, "S", BULL_COLOR);
    }
  }

  // ── 5. Footer: disclaimer — renderShareCard.ts'teki footer deseniyle aynı font/renk ──
  const footerY = H - PAD - 44;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, footerY - 32);
  ctx.lineTo(W - PAD, footerY - 32);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = font(20, 600);
  ctx.fillStyle = "#f0a850";
  ctx.fillText(score.disclaimer, PAD, footerY);

  // Güncel fiyat — spesifikasyonun 5 maddesinde açıkça istenmedi, ama
  // ScenarioChartData'da veri olarak var; footer'ın hemen üstünde küçük
  // bir bilgi satırı olarak BİLEREK EKLENDİ (currentPrice parametresi
  // aksi halde hiçbir yerde kullanılmazdı) — istemiyorsan kaldırırım.
  ctx.font = font(16);
  ctx.fillStyle = "#5a6078";
  ctx.fillText(`Güncel Fiyat: $${currentPrice}`, PAD, footerY + 26);
}
