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
 * app/karar/layout.tsx'te (bu dosyanın TEK çağıranı ShareButton.tsx,
 * sadece /karar'da render ediliyor — önceden root layout'taydı, perf
 * teşhisinde her sayfaya bulaştığı bulunup route-özel layout'a taşındı) —
 * Next.js global CSS'in yalnızca layout/page dosyasından import edilmesini
 * şart koşuyor, bileşen olmayan bir lib dosyasından import edilirse derleme
 * patlayabilir.
 *
 * Logo — public/quantix-logo.png aynı-origin bir <img> olarak yükleniyor
 * (bkz. renderShareCard.ts dosya başı yorumu: drawImage() taint riski
 * TAŞIMIYOR, önceki bulgu foreignObject'e özgüydü). Süreç ömrü boyunca
 * bir kez yüklenip modül düzeyinde önbelleğe alınıyor.
 */

import {
  renderShareCard,
  SHARE_CARD_SIZE,
  type ShareCardData,
  type ShareCanvasContext,
  type ShareImageSource,
} from "./renderShareCard";
import { CARD_FONT_FAMILY } from "./fontConstants";

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

let cachedLogoImagePromise: Promise<HTMLImageElement> | null = null;

function loadLogoImage(): Promise<HTMLImageElement> {
  if (!cachedLogoImagePromise) {
    cachedLogoImagePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new ShareCardExportError("Logo yüklenemedi: /quantix-logo.png"));
      img.src = "/quantix-logo.png";
    });
  }
  return cachedLogoImagePromise;
}

export async function exportShareCardPng(data: ShareCardData): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new ShareCardExportError("exportShareCardPng sadece client'ta çalışır.");
  }

  const [, logoImage] = await Promise.all([ensureFontsLoaded(), loadLogoImage()]);

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
  renderShareCard(ctx as unknown as ShareCanvasContext, data, logoImage as ShareImageSource);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new ShareCardExportError("canvas.toBlob() null döndü.");
  }
  return blob;
}
