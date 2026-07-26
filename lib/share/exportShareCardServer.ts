/**
 * SHARE CARD EXPORT (SUNUCU) — renderShareCard()'ı @napi-rs/canvas ile
 * Node üzerinde çizip PNG Buffer üretir. "Tek çizim kodu, iki çağıran"
 * deseninin sunucu ince sarmalayıcısı — tarayıcı tarafı için bkz.
 * exportShareCard.ts. Kütüphane seçimi (napi-rs/canvas, node-canvas
 * değil) ve gerekçesi için bkz. next.config.ts serverExternalPackages
 * yorumu.
 *
 * FONT — HENÜZ DOĞRULANMADI: @napi-rs/canvas'ın GlobalFonts.registerFromPath()
 * fonksiyonu dokümante edilen tüm örneklerde .ttf/.otf alıyor, .woff2 değil
 * (bkz. node-woff2-rs — bu boşluk için var olan ayrı bir dönüştürme aracı,
 * .woff2'nin native desteklenmediğine güçlü bir kanıt). Fontsource paketleri
 * (tarayıcı tarafında kullanılan @fontsource/ibm-plex-mono) SADECE .woff/.woff2
 * dağıtıyor — kendi açık GitHub issue'ları (#371) bunu doğruluyor. Yani bu
 * npm paketinden sunucu için doğrudan kullanılabilir bir .ttf YOK.
 *
 * Bu dosya IBM Plex Mono'nun resmi TTF kaynağından (github.com/IBM/plex)
 * gelecek dosyaları FONT_FILES altında bekliyor — bu sandbox'ta GitHub'a
 * ağ erişimi engellendiği için bu binary dosyalar buraya BENİM tarafımdan
 * eklenemedi. Dosyalar yoksa registerFonts() açıkça hata fırlatır (CLAUDE.md
 * §0.1 madde 3: sessiz fallback yok, "bilinmiyor/eksik" durumu görünür
 * olmalı) — sistemin sessizce sistem fontuna düşüp "çalışıyor" izlenimi
 * vermesi burada YANLIŞ olur, çünkü asıl hedef iki tarafın da AYNI fontu
 * kullandığını garanti etmekti.
 *
 * Beklenen dosya yolları (github.com/IBM/plex resmi TTF export'u,
 * IBM-Plex-Mono/fonts/complete/ttf/ altında) — kesin dosya adları
 * indirilene kadar doğrulanmadı, en olası isimlendirme:
 *   lib/share/fonts/IBMPlexMono-Regular.ttf   (400)
 *   lib/share/fonts/IBMPlexMono-Medium.ttf    (500)
 *   lib/share/fonts/IBMPlexMono-SemiBold.ttf  (600)
 *   lib/share/fonts/IBMPlexMono-Bold.ttf      (700)
 */

import path from "node:path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import {
  renderShareCard,
  SHARE_CARD_SIZE,
  CARD_FONT_FAMILY,
  type ShareCardData,
  type ShareCanvasContext,
} from "./renderShareCard";

export class ShareCardServerExportError extends Error {}

const FONT_DIR = path.join(process.cwd(), "lib/share/fonts");

const FONT_FILES = [
  "IBMPlexMono-Regular.ttf",
  "IBMPlexMono-Medium.ttf",
  "IBMPlexMono-SemiBold.ttf",
  "IBMPlexMono-Bold.ttf",
] as const;

let fontsRegistered = false;

/**
 * Her çağrıda yeniden diske bakmamak için process ömrü boyunca bir kez
 * çalışır (Next.js Node runtime'da modül instance'ı süreç boyunca canlı
 * kalır). Herhangi bir dosya eksikse veya kayıt başarısızsa AÇIKÇA fırlatır
 * — see dosya başı yorumu, sessiz fallback yok.
 */
function registerFonts(): void {
  if (fontsRegistered) return;
  for (const file of FONT_FILES) {
    const fullPath = path.join(FONT_DIR, file);
    let ok: boolean;
    try {
      ok = GlobalFonts.registerFromPath(fullPath, CARD_FONT_FAMILY);
    } catch (err) {
      throw new ShareCardServerExportError(
        `Font dosyası okunamadı: ${fullPath} — sunucu tarafı kart üretimi ` +
          `için IBM Plex Mono .ttf dosyaları henüz eklenmedi (bkz. dosya başı ` +
          `yorumu). Orijinal hata: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!ok) {
      throw new ShareCardServerExportError(
        `GlobalFonts.registerFromPath() ${fullPath} için false döndü — font kaydı başarısız.`,
      );
    }
  }
  fontsRegistered = true;
}

export function exportShareCardPngServer(data: ShareCardData): Buffer {
  registerFonts();

  const canvas = createCanvas(SHARE_CARD_SIZE, SHARE_CARD_SIZE);
  const ctx = canvas.getContext("2d");

  // Dar cast — bkz. renderShareCard.ts'teki ShareCanvasContext yorumu ve
  // exportShareCard.ts'teki aynı cast (tarayıcı tarafı) için gerekçe.
  renderShareCard(ctx as unknown as ShareCanvasContext, data);

  return canvas.toBuffer("image/png");
}
