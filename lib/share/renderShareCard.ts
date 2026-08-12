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
 * Logo — DÜZELTME: önceki sürüm public/quantix-logo.svg'yi (eski, artık
 * kullanılmayan bir "Q" harfi placeholder'ı) vektör path/gradient olarak
 * çiziyordu, "aynı görsel kimlik" iddiasıyla. Bu iddia YANLIŞTI — uygulamanın
 * her yerinde gerçek marka logosu components/brand/QuantixLogo.tsx →
 * public/quantix-logo.png (boğa kafası temalı madalyon illüstrasyonu),
 * SVG'yle hiç eşleşmiyor (kullanıcı gerçek header'la kartı yan yana koyup
 * fark etti — bkz. commit mesajı). Artık ctx.drawImage() ile gerçek PNG
 * çiziliyor (dairesel clip ile, PNG'nin köşeleri şeffaf değil).
 *
 * drawImage() taint riski TAŞIMIYOR — daha önce bulunan "tainted canvas"
 * hatası özellikle <foreignObject> içine HTML gömme tekniğinden
 * kaynaklanıyordu (html-to-image'in çalışma prensibi). Aynı-origin bir
 * <img>'i (tarayıcıda) veya dosyadan yüklenen bir Image'i (sunucuda,
 * @napi-rs/canvas loadImage) drawImage() ile çizmek CORS/taint modeline
 * hiç girmiyor — standart, güvenli bir işlem. Resim renderShareCard()
 * ÇAĞRILMADAN ÖNCE ince sarmalayıcılar (exportShareCard.ts,
 * exportShareCardServer.ts) tarafından ASENKRON yükleniyor — renderShareCard
 * kendisi SENKRON kalıyor, sadece önceden yüklenmiş image handle'ını alıyor.
 *
 * TEK ÇİZİM KODU, İKİ ÇAĞIRAN (kullanıcı kararı): bu fonksiyon SAF —
 * hangi ortamda (tarayıcı/sunucu) çalıştığını bilmiyor, sadece verilen
 * context'e çiziyor. lib/share/exportShareCard.ts (tarayıcı, gerçek
 * CanvasRenderingContext2D) ve lib/share/exportShareCardServer.ts
 * (sunucu, @napi-rs/canvas SKRSContext2D) ince sarmalayıcılar — context'i
 * hazırlayıp bu fonksiyona geçiriyorlar. İki ayrı çizim kodu YOK, zamanla
 * ayrışma riski yapısal olarak yok. `ShareCanvasContext` interface'i
 * ikisinin de yapısal olarak sağladığı ortak alt küme.
 *
 * Font — IBM Plex Mono, @fontsource/ibm-plex-mono paketinden, İKİ TARAFA
 * DA AYNI KAYNAKTAN (kullanıcı kararı — sistem fontuyla tarayıcı, marka
 * fontuyla sunucu çizerse "tek çizim kodu" hedefi anlamsızlaşır, aynı kod
 * iki farklı görüntü üretir). Fontsource self-host için tasarlanmış —
 * kendi alan adından servis edilir, CDN bağımlılığı yok (Google Fonts CDN
 * riski burada geçerli değil). IBM Plex Mono'nun gerçek ağırlıkları
 * 100-700 (Thin→Bold) — bu dosyadaki 800/900 istekleri gerçek bir kesim
 * değil, her iki ortamda da en yakın mevcut ağırlığa (700) düşer; kasıtlı
 * bırakıldı, görsel tasarım bu diff'in konusu değil.
 */

import type { Pair } from "@/lib/constants/pairs";
import type { Direction, ScoreSubScores } from "@/lib/score/orchestrator";
import type { ConfirmStatus } from "@/lib/store/signalConfirmStore";
import { CATEGORIES } from "@/lib/score/categories";
import { BRAND } from "@/lib/brand";
import { CARD_FONT_FAMILY } from "./fontConstants";

/**
 * renderShareCard()'ın ihtiyaç duyduğu Canvas 2D metodlarının/alanlarının
 * DAR bir alt kümesi — hem gerçek DOM CanvasRenderingContext2D hem
 * @napi-rs/canvas'ın SKRSContext2D'si davranışsal olarak bunu sağlıyor.
 * Gradient dönüş tipi DOM'un CanvasGradient'ına kasıtlı olarak bağlanmadı
 * (kendi minimal ShareGradient şekli) — napi-rs'in gradient nesnesi DOM
 * tipiyle birebir eşleşmeyebilir, sadece addColorStop() kullanılıyor zaten.
 *
 * DÜZELTME (tsc ile doğrulandı): gerçek CanvasRenderingContext2D.fillStyle
 * tipi `string | CanvasGradient | CanvasPattern` — CanvasPattern'de
 * addColorStop yok, dolayısıyla bu union ShareGradient'a yapısal olarak
 * UYMUYOR. Yani "cast gerekmiyor" iddiası yanlıştı — gerçek context'i
 * çağıran iki ince sarmalayıcı (exportShareCard.ts, exportShareCardServer.ts)
 * `as unknown as ShareCanvasContext` ile dar bir cast yapıyor. Bu bir
 * "her ihtimalde güvenli" cast değil, dar ve doğrulanmış bir varsayıma
 * dayanıyor: renderShareCard hiçbir yerde fillStyle/strokeStyle'a
 * CanvasPattern ATAMIYOR (sadece string veya createLinearGradient/
 * createRadialGradient dönüşü) — bu dosyadaki tüm ctx.fillStyle=/
 * ctx.strokeStyle= çağrıları grep ile doğrulanabilir.
 */
export interface ShareGradient {
  addColorStop(offset: number, color: string): void;
}

/** Tarayıcıda HTMLImageElement, sunucuda @napi-rs/canvas'ın yüklenmiş
 *  Image'i — ikisi de drawImage()'a doğrudan geçirilebilir, ortak bir DOM
 *  tipine kasıtlı olarak bağlanmadı (aynı ShareGradient gerekçesi). */
export type ShareImageSource = unknown;

export interface ShareCanvasContext {
  fillStyle: string | ShareGradient;
  strokeStyle: string | ShareGradient;
  font: string;
  textAlign: string;
  textBaseline: string;
  globalAlpha: number;
  lineWidth: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  closePath(): void;
  arc(x: number, y: number, r: number, start: number, end: number): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  save(): void;
  restore(): void;
  setLineDash(segments: number[]): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): ShareGradient;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): ShareGradient;
  translate(x: number, y: number): void;
  drawImage(image: ShareImageSource, dx: number, dy: number, dw: number, dh: number): void;
}

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

// CARD_FONT_FAMILY artık lib/share/fontConstants.ts'ten import ediliyor (tek
// kaynak, renderScenarioChart.ts ile paylaşılıyor — kullanıcı kararı,
// magic-string tekrarı/senkron riskini ortadan kaldırmak için). Sistem monospace fallback
// zinciri, kayıtlı font bir sebeple (henüz yüklenmedi, kayıt başarısız)
// kullanılamazsa görsel tamamen bozulmasın diye kalıyor, birincil seçim değil.
const CARD_FONT = `"${CARD_FONT_FAMILY}", ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace`;

const VERDICT_COLORS: Record<"go" | "wait" | "no", { bg: string; fg: string }> = {
  go: { bg: "#0e7030", fg: "#eafff0" },
  wait: { bg: "#9e5a08", fg: "#fff4e0" },
  no: { bg: "#9a0e0e", fg: "#ffecec" },
};

/** Büyük skor rakamının rengi — VERDICT'e göre, skor eşiğine göre DEĞİL
 *  (kullanıcı kararı). Önceki sürüm getScoreColor() (skor eşiği bazlı 5-bant
 *  sistem, lib/ui/scoreColor.ts) kullanıyordu; verdict ise motorun tamamına
 *  bağlı (hard/soft bloklar dahil) — bloklanmış yüksek skorlu bir sinyalde
 *  ikisi ayrışabiliyor, halka açık kartta yeşil bir sayı ile kırmızı "HAYIR"
 *  pili yan yana yanıltıcı olurdu. Kartta tek renk otoritesi verdict.
 *  Kategori barları (aşağıda, ayrı bir eksen — kategori bazlı doluluk oranı)
 *  hiçbir zaman getScoreColor() kullanmıyordu, kendi satır-içi eşik mantığına
 *  sahipler — o kasıtlı olarak değişmedi. */
const VERDICT_SCORE_COLOR: Record<"go" | "wait" | "no", string> = {
  go: "#3ee97d",
  wait: "#ffcf5a",
  no: "#ff3b3b",
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
function roundRectPath(ctx: ShareCanvasContext, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Gerçek marka logosu (public/quantix-logo.png) — kare PNG'nin köşeleri
 *  şeffaf değil, bu yüzden dairesel bir clip path içine çiziliyor (aynı
 *  QuantixLogo.tsx'in tarayıcıda CSS rounded-full ile yaptığı, burada
 *  canvas clip() ile). */
function drawLogo(ctx: ShareCanvasContext, image: ShareImageSource, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

export function renderShareCard(ctx: ShareCanvasContext, data: ShareCardData, logoImage: ShareImageSource): void {
  const { verdict, confirmStatus } = data;
  const verdictColor = VERDICT_COLORS[verdict];

  // Arkaplan
  const bg = ctx.createLinearGradient(0, 0, 0, W);
  bg.addColorStop(0, "#0a0c14");
  bg.addColorStop(0.55, "#12141f");
  bg.addColorStop(1, "#090a10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, W);

  ctx.textBaseline = "alphabetic";

  // ── Header: logo + marka + tarih ──
  drawLogo(ctx, logoImage, PAD + 36, PAD + 36, 36);
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
  ctx.fillStyle = VERDICT_SCORE_COLOR[verdict];
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
