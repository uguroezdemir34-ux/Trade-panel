/**
 * SHARE CARD RENDERER — sabit 1080×1080 kartı doğrudan Canvas 2D API'siyle
 * çizer. DOM/foreignObject/html-to-image YOK — kasıtlı.
 *
 * Sebep (elle doğrulandı, bkz. commit mesajı): bu ortamın Chromium'unda
 * (141.0.7390.37) <svg><foreignObject>HTML</foreignObject></svg> → canvas
 * çizimi, hiçbir harici kaynak olmasa bile (aynı origin, CORS'suz, boş bir
 * <div> bile) canvas'ı "tainted" işaretliyor — toBlob()/toDataURL() güvenlik
 * hatasıyla patlıyor. İzole test: foreignObject'siz SVG ve saf canvas API
 * (fillText/gradient) TEMİZ, foreignObject'li SVG (içerik ne olursa olsun)
 * HER ZAMAN kirli. html-to-image'in TÜM çalışma prensibi foreignObject'e
 * dayandığı için (alternatifi yok) bu ortamda temelden çalışmıyor.
 *
 * Bu dosya TEK bir sabit kartı çiziyor — genel amaçlı bir "template motoru"
 * DEĞİL (kullanıcı kararı: genelleştirmeye gerek yok, tek kart yeterli).
 *
 * Kategori çubukları ile büyük skor NEDEN toplanmıyor (kasıtlı, denetim izi
 * DEĞİL): baseScore = Σ(sub[cat]×w[cat]) / Σ(MAX[cat]×w[cat]) × 100 —
 * w rejime göre (adaptiveWeights.ts) ve kullanıcı ayarına göre değişiyor,
 * yani kategori satırları (ham, ağırlıksız) zaten baseScore'un toplamı
 * değil — modifier'lar (sweep/regime/S-R) eklenmeden ÖNCE bile. Bu yüzden
 * kart bir "modifier satırları ekleyip toplamı tutturma" numarası yapmıyor
 * (kullanıcı kararı — yarım bir denetim izi, hiç iddia etmemekten daha
 * kötü, güven değil şüphe üretir). Bunun yerine dürüst etiketleme: bar
 * bloğu "HAM" olduğunu söylüyor, büyük skorun yanında "ağırlıklandırılmış"
 * notu var. Kimse toplamaya kalkışmasın diye kart zaten toplanacağını
 * iddia etmiyor.
 *
 * Logo: SVG <img>/drawImage DEĞİL — public/quantix-logo.svg'nin görsel
 * kimliğini (halka + gradient "Q" + iç parlama + alt aksan çizgileri) aynı
 * canvas context'e vektör path/gradient olarak çiziyor. Hiçbir görsel
 * kaynak yüklenmiyor, dolayısıyla drawImage() hiç çağrılmıyor — taint
 * riski yapısal olarak yok.
 */

import type { Pair } from "@/lib/constants/pairs";
import type { Direction, ScoreSubScores } from "@/lib/score/orchestrator";
import type { ConfirmStatus } from "@/lib/store/signalConfirmStore";
import { CATEGORIES } from "@/components/karar/ScoreBreakdown";
import { getScoreColor } from "@/lib/ui/scoreColor";
import { BRAND } from "@/lib/brand";

export const SHARE_CARD_SIZE = 1080;

export interface ShareCardData {
  pair: Pair;
  direction: Direction;
  verdict: "go" | "wait" | "no";
  confirmStatus: ConfirmStatus | null;
  score: number;
  sub: ScoreSubScores;
  priceLabel: string;
  ts: number;
  locale: string;
  labels: {
    verdict: Record<"go" | "wait" | "no", string>;
    direction: Record<Direction, string>;
    confirmPending: string;
    confirmUnknown: string;
    disclaimer: string;
    categories: Record<string, string>;
    /** "rejime göre ağırlıklandırılmış" notu — büyük skorun yanında. */
    scoreWeightedNote: string;
    /** "HAM KATEGORİ SKORLARI" — bar bloğunun başlığı. */
    categoriesRawLabel: string;
  };
}

const CARD_FONT = 'ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace';

const VERDICT_COLORS: Record<"go" | "wait" | "no", { bg: string; fg: string }> = {
  go: { bg: "#0e7030", fg: "#eafff0" },
  wait: { bg: "#9e5a08", fg: "#fff4e0" },
  no: { bg: "#9a0e0e", fg: "#ffecec" },
};

const DIRECTION_ICON: Record<Direction, string> = { LONG: "▲", SHORT: "▼", NEUTRAL: "◆" };
const DIRECTION_COLOR: Record<Direction, string> = { LONG: "#6ee89a", SHORT: "#f08080", NEUTRAL: "#a8b0bc" };

const PAD = 56;
const W = SHARE_CARD_SIZE;

function font(size: number, weight = 400): string {
  return `${weight} ${size}px ${CARD_FONT}`;
}

/** Yuvarlatılmış dikdörtgen path — ctx.roundRect() modern tarayıcılarda var,
 *  ama elle çizmek eski WebView sürümlerinde de garanti çalışır. */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** public/quantix-logo.svg ile aynı görsel kimlik — vektör path/gradient,
 *  hiçbir görsel kaynak yüklenmiyor (bkz. dosya başı yorumu). */
function drawLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx - r, cy - r);
  const s = r / 100; // orijinal SVG 200x200 viewBox, yarıçap 100 birim

  // Dış metalik halka
  ctx.beginPath();
  ctx.arc(100 * s, 100 * s, 90 * s, 0, Math.PI * 2);
  const ringGrad = ctx.createLinearGradient(0, 0, 200 * s, 200 * s);
  ringGrad.addColorStop(0, "#888");
  ringGrad.addColorStop(0.4, "#fff");
  ringGrad.addColorStop(1, "#555");
  ctx.strokeStyle = ringGrad;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2.5 * s;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // İç parlama (radyal gradient)
  const glowGrad = ctx.createRadialGradient(100 * s, 85 * s, 0, 100 * s, 85 * s, 55 * s);
  glowGrad.addColorStop(0, "rgba(255,213,128,0.9)");
  glowGrad.addColorStop(1, "rgba(255,107,26,0)");
  ctx.beginPath();
  ctx.arc(100 * s, 85 * s, 55 * s, 0, Math.PI * 2);
  ctx.fillStyle = glowGrad;
  ctx.globalAlpha = 0.35;
  ctx.fill();
  ctx.globalAlpha = 1;

  // "Q" harfi — gradient dolgulu
  const qGrad = ctx.createLinearGradient(0, 0, 100 * s, 200 * s);
  qGrad.addColorStop(0, "#FFB347");
  qGrad.addColorStop(0.55, "#FF6B1A");
  qGrad.addColorStop(1, "#CC4400");
  ctx.fillStyle = qGrad;
  ctx.font = `900 ${110 * s}px "SF Pro Display","Helvetica Neue","Arial Black",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Q", 100 * s, 125 * s);

  // Alt aksan çizgileri
  ctx.fillStyle = "rgba(255,107,26,0.7)";
  roundRectPath(ctx, 55 * s, 155 * s, 90 * s, 2.5 * s, 1.25 * s);
  ctx.fill();
  ctx.fillStyle = "rgba(255,107,26,0.3)";
  roundRectPath(ctx, 75 * s, 161 * s, 50 * s, 1.5 * s, 0.75 * s);
  ctx.fill();

  ctx.restore();
}

export function renderShareCard(ctx: CanvasRenderingContext2D, data: ShareCardData): void {
  const { verdict, confirmStatus } = data;
  const verdictColor = VERDICT_COLORS[verdict];
  const scoreBand = getScoreColor(data.score);

  // Arkaplan
  const bg = ctx.createLinearGradient(0, 0, 0, W);
  bg.addColorStop(0, "#0a0c14");
  bg.addColorStop(0.55, "#12141f");
  bg.addColorStop(1, "#090a10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, W);

  ctx.textBaseline = "alphabetic";

  // ── Header: logo + marka + tarih ──
  drawLogo(ctx, PAD + 36, PAD + 36, 36);
  ctx.textAlign = "left";
  ctx.fillStyle = "#e8eaf4";
  ctx.font = font(34, 700);
  ctx.fillText(BRAND.name, PAD + 92, PAD + 30);
  ctx.fillStyle = "#8890a4";
  ctx.font = font(18);
  ctx.fillText(BRAND.tagline, PAD + 92, PAD + 55);

  const dateStr = new Date(data.ts).toLocaleString(data.locale === "tr" ? "tr-TR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  ctx.textAlign = "right";
  ctx.font = font(20);
  ctx.fillStyle = "#8890a4";
  ctx.fillText(dateStr, W - PAD, PAD + 40);

  // ── Pair + yön + fiyat ──
  let y = PAD + 72 + 48;
  ctx.textAlign = "left";
  ctx.fillStyle = "#e8eaf4";
  ctx.font = font(76, 800);
  ctx.fillText(data.pair, PAD, y);
  const pairWidth = ctx.measureText(data.pair).width;

  ctx.font = font(30);
  ctx.fillStyle = DIRECTION_COLOR[data.direction];
  ctx.fillText(`${DIRECTION_ICON[data.direction]} ${data.labels.direction[data.direction]}`, PAD + pairWidth + 16, y);

  ctx.textAlign = "right";
  ctx.font = font(34);
  ctx.fillStyle = "#c8cce0";
  ctx.fillText(data.priceLabel, W - PAD, y);

  // ── Verdict pill + teyit durumu ──
  y += 32 + 16;
  const pillH = 72;
  const pillPadX = 28;
  ctx.font = font(40, 800);
  const verdictLabel = data.labels.verdict[verdict];
  const confirmLabel =
    confirmStatus === "pending" ? data.labels.confirmPending : confirmStatus === "unknown" ? data.labels.confirmUnknown : null;
  const verdictTextWidth = ctx.measureText(verdictLabel).width;
  ctx.font = font(22, 500);
  const confirmTextWidth = confirmLabel ? ctx.measureText(` · ${confirmLabel}`).width : 0;
  const pillW = pillPadX * 2 + verdictTextWidth + confirmTextWidth + 14;

  ctx.textAlign = "left";
  roundRectPath(ctx, PAD, y, pillW, pillH, 16);
  ctx.fillStyle = verdictColor.bg;
  if (confirmStatus === "pending") ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.globalAlpha = 1;
  if (confirmStatus === "pending" || confirmStatus === "unknown") {
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    roundRectPath(ctx, PAD, y, pillW, pillH, 16);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = verdictColor.fg;
  ctx.font = font(40, 800);
  ctx.fillText(verdictLabel, PAD + pillPadX, y + pillH / 2 + 14);
  if (confirmLabel) {
    ctx.font = font(22, 500);
    ctx.globalAlpha = 0.85;
    ctx.fillText(` · ${confirmLabel}`, PAD + pillPadX + verdictTextWidth + 14, y + pillH / 2 + 8);
    ctx.globalAlpha = 1;
  }

  // ── Skor (rejime göre ağırlıklandırılmış — bkz. dosya başı yorumu) ──
  y += pillH + 44 + 100;
  ctx.textAlign = "left";
  ctx.font = font(140, 900);
  ctx.fillStyle = scoreBand.color;
  const scoreText = String(Math.round(data.score));
  ctx.fillText(scoreText, PAD, y);
  const scoreWidth = ctx.measureText(scoreText).width;
  ctx.font = font(32);
  ctx.fillStyle = "#6a7086";
  ctx.fillText("/ 100", PAD + scoreWidth + 18, y);
  ctx.textAlign = "right";
  ctx.font = font(20);
  ctx.fillStyle = "#6a7086";
  ctx.fillText(data.labels.scoreWeightedNote, W - PAD, y);

  // ── Kategori kırılımı — HAM (ağırlıksız) skorlar, baseScore'un toplamı DEĞİL ──
  // toLocaleUpperCase(data.locale) — toUpperCase() Türkçe "i"yi "I"ya çevirir
  // (dotless), doğrusu "İ" (dotted) — "Hacim" gibi kelimeler bozuk çıkardı.
  y += 56;
  ctx.textAlign = "left";
  ctx.font = font(20, 600);
  ctx.fillStyle = "#5a6078";
  ctx.fillText(data.labels.categoriesRawLabel.toLocaleUpperCase(data.locale), PAD, y);

  const barX = PAD + 150 + 16;
  const barW = W - PAD - barX - 70 - 16;
  const rowH = 42;
  for (const cat of CATEGORIES) {
    y += rowH;
    const val = data.sub[cat.key];
    const pct = Math.min(1, val / cat.max);
    ctx.textAlign = "left";
    ctx.font = font(22);
    ctx.fillStyle = "#8890a4";
    ctx.fillText((data.labels.categories[cat.key] ?? cat.key).toLocaleUpperCase(data.locale), PAD, y + 6);

    roundRectPath(ctx, barX, y - 8, barW, 18, 9);
    ctx.fillStyle = "#181a26";
    ctx.fill();
    roundRectPath(ctx, barX, y - 8, barW * pct, 18, 9);
    ctx.fillStyle = pct * 100 >= 70 ? "#1e6e38" : pct * 100 >= 35 ? "#6e5018" : "#6e1e1e";
    ctx.fill();

    ctx.textAlign = "right";
    ctx.font = font(22);
    ctx.fillStyle = "#c8cce0";
    ctx.fillText(`${Math.round(val)}/${cat.max}`, W - PAD, y + 6);
  }

  // ── Footer: uyarı + marka ──
  const footerY = W - PAD - 44;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, footerY - 32);
  ctx.lineTo(W - PAD, footerY - 32);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = font(20, 600);
  ctx.fillStyle = "#f0a850";
  ctx.fillText(data.labels.disclaimer, PAD, footerY);
  ctx.font = font(18);
  ctx.fillStyle = "#5a6078";
  ctx.fillText("quantixos.com", PAD, footerY + 26);
}
