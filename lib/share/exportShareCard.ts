/**
 * SHARE CARD EXPORT — renderShareCard()'ı bir offscreen <canvas>'a çizip
 * PNG Blob üretir. DOM node YOK, foreignObject YOK — bkz.
 * renderShareCard.ts dosya başı yorumu (taint bulgusu).
 *
 * document.fonts.ready: fillText() özel bir fontu ancak font YÜKLENMİŞSE
 * kullanır, yüklenmemişse sessizce varsayılana (genelde serif) düşer —
 * hata fırlatmaz, sadece yanlış görünür. CARD_FONT (renderShareCard.ts)
 * kasıtlı olarak sadece sistem monospace stack'i kullanıyor (harici CDN
 * yok), bu yüzden bu bekleme teorik olarak gereksiz — ama ucuz ve doğru
 * bir alışkanlık, ileride bir webfont eklenirse sessizce yanlış render
 * riskini baştan kapatıyor.
 */

import { renderShareCard, SHARE_CARD_SIZE, type ShareCardData } from "./renderShareCard";

export class ShareCardExportError extends Error {}

export async function exportShareCardPng(data: ShareCardData): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new ShareCardExportError("exportShareCardPng sadece client'ta çalışır.");
  }

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const canvas = document.createElement("canvas");
  canvas.width = SHARE_CARD_SIZE;
  canvas.height = SHARE_CARD_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new ShareCardExportError("2d canvas context alınamadı.");
  }

  renderShareCard(ctx, data);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) {
    throw new ShareCardExportError("canvas.toBlob() null döndü.");
  }
  return blob;
}
