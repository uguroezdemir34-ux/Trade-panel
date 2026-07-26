/**
 * SHARE CARD EXPORT (TARAYICI) — renderShareCard()'ı bir offscreen
 * <canvas>'a çizip PNG Blob üretir. DOM node YOK, foreignObject YOK —
 * bkz. renderShareCard.ts dosya başı yorumu (taint bulgusu). Bu dosya
 * "tek çizim kodu, iki çağıran" desenindeki tarayıcı ince sarmalayıcısı
 * — sunucu tarafı için bkz. exportShareCardServer.ts.
 *
 * Font yükleme — document.fonts.ready TEK BAŞINA YETERSİZ: canvas metin
 * çizimi DOM metni gibi otomatik webfont yüklemesi TETİKLEMİYOR (bu
 * bilinen, dokümante edilmiş bir platform davranışı — font hiç bir DOM
 * elemanında kullanılmadıysa tarayıcı onu hiç istemeyebilir, bu durumda
 * document.fonts.ready anında ve boş çözülür, "yüklendi" değil "bekleyen
 * yükleme yok" anlamına gelir). Bu yüzden çizimden ÖNCE her ağırlık için
 * document.fonts.load() ile AÇIKÇA tetikleniyor — CARD_FONT_FAMILY
 * ("IBM Plex Mono") global CSS'e @fontsource/ibm-plex-mono importuyla
 * @font-face olarak zaten tanımlı. Bu importlar BİLEREK bu dosyada değil,
 * app/layout.tsx'te — Next.js global CSS'in yalnızca root layout'tan (ya
 * da _app'ten) import edilmesini şart koşuyor, bileşen olmayan bir lib
 * dosyasından import edilirse derleme patlayabilir.
 */

import {
  renderShareCard,
  SHARE_CARD_SIZE,
  CARD_FONT_FAMILY,
  type ShareCardData,
  type ShareCanvasContext,
} from "./renderShareCard";

export class ShareCardExportError extends Error {}

// renderShareCard.ts'te kullanılan tüm ağırlıklar — 800/900 gerçek bir
// kesim değil (IBM Plex Mono 100-700), ama font-matching'in en yakın
// mevcut yüze (700) düşmesi için bu ağırlıkları da isteriz, aksi halde
// tarayıcı hiçbir yüzü "istemediği" bir durumda kalabilir.
const CARD_FONT_WEIGHTS = [400, 500, 600, 700, 800, 900] as const;

async function ensureFontsLoaded(): Promise<void> {
  if (!document.fonts) return;
  await Promise.all(
    CARD_FONT_WEIGHTS.map((w) => document.fonts.load(`${w} 16px "${CARD_FONT_FAMILY}"`)),
  );
  await document.fonts.ready;
}

export async function exportShareCardPng(data: ShareCardData): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new ShareCardExportError("exportShareCardPng sadece client'ta çalışır.");
  }

  await ensureFontsLoaded();

  const canvas = document.createElement("canvas");
  canvas.width = SHARE_CARD_SIZE;
  canvas.height = SHARE_CARD_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new ShareCardExportError("2d canvas context alınamadı.");
  }

  // Dar cast — bkz. renderShareCard.ts'teki ShareCanvasContext yorumu:
  // gerçek fillStyle/strokeStyle tipi CanvasPattern içeriyor (ShareGradient'a
  // yapısal olarak uymuyor), ama renderShareCard bu ikisine hiçbir yerde
  // CanvasPattern atamıyor — doğrulandı.
  renderShareCard(ctx as unknown as ShareCanvasContext, data);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new ShareCardExportError("canvas.toBlob() null döndü.");
  }
  return blob;
}
