/**
 * SHARE CARD EXPORT (SUNUCU) — renderShareCard()'ı @napi-rs/canvas ile
 * Node üzerinde çizip PNG Buffer üretir. "Tek çizim kodu, iki çağıran"
 * deseninin sunucu ince sarmalayıcısı — tarayıcı tarafı için bkz.
 * exportShareCard.ts. Kütüphane seçimi (napi-rs/canvas, node-canvas
 * değil) ve gerekçesi için bkz. next.config.ts serverExternalPackages
 * yorumu.
 *
 * FONT KAYNAĞI — @expo-google-fonts/ibm-plex-mono: sıfır çalışma zamanı
 * bağımlılığı olan, sadece statik .ttf dosyaları taşıyan bir npm paketi
 * (Metro/React Native varsayımı yok — asset'ler düz dosya, bu yüzden Node
 * fs ile doğrudan okunabilir). Önceki tasarımda (github.com/IBM/plex'ten
 * elle indirilecek .ttf) bu sandbox'ın GitHub'a ağ erişiminin engelli
 * olması net bir blokajdı; npm paketine geçiş bu blokajı ORTADAN KALDIRIR
 * (paket npm install ile gelir, elle dosya eklemeye gerek yok) — ancak bu
 * sandbox'ta registry.npmjs.org'a erişim de engelli (npm view/curl ile
 * doğrulandı, 403), yani paketin GERÇEKTEN kurulup çalıştığı BEN tarafımdan
 * burada doğrulanamadı. Vercel'in build ortamının npm registry'ye tam
 * erişimi var, bu yüzden orada çalışması beklenir ama bu bir doğrulama
 * DEĞİL, bir beklenti — CLAUDE.md §0.1 madde 2 gereği böyle işaretleniyor.
 *
 * Not (tarayıcı tarafıyla küçük bir fark): tarayıcı hâlâ @fontsource/
 * ibm-plex-mono kullanıyor (app/layout.tsx) — bu iki paket IBM Plex
 * Mono'nun AYNI yukarı akış (upstream) OFL fontunun farklı ekipler
 * tarafından yapılan iki ayrı npm repaketlemesi, birebir aynı npm kaynağı
 * değil. Görsel olarak ayırt edilemez olması beklenir (ikisi de Google
 * Fonts'un yayınladığı aynı font dosyalarından türüyor) ama bu da
 * doğrulanmadı, sadece makul bir varsayım.
 *
 * Dosya yolları — kullanıcı paketi bizzat indirip içini listeleyerek
 * doğruladı (bu BENİM tarafımdan bu sandbox'ta bağımsız doğrulanmadı,
 * ama artık bir tahmin değil, kaynağı kullanıcının gerçek incelemesi):
 *   400Regular/IBMPlexMono_400Regular.ttf
 *   500Medium/IBMPlexMono_500Medium.ttf
 *   600SemiBold/IBMPlexMono_600SemiBold.ttf
 *   700Bold/IBMPlexMono_700Bold.ttf
 * Paket ayrıca italik varyantları da içeriyor (ör. 400Regular_Italic/) —
 * renderShareCard hiçbir yerde italik font kullanmıyor, kullanılmıyorlar.
 *
 * Kök çözümleme — require.resolve() DEĞİL, process.cwd() tabanlı düz fs
 * yolu: önceki sürüm require.resolve(`${FONT_PACKAGE}/package.json`)
 * kullanıyordu — şablon dize (template literal) ile çağrıldığı için
 * webpack'in statik analizi bunu modül grafiğine ekleyemiyor, bu da
 * Vercel'de runtime'da çözümlemenin başarısız olmasına yol açıyor
 * (kullanıcı tespiti). outputFileTracingIncludes ile dahil edilen
 * dosyalar serverless fonksiyonda proje köküne göre aynı dizin yapısıyla
 * yerleşiyor, bu yüzden process.cwd() + sabit node_modules yolu doğru
 * desen — package.json'a artık ihtiyaç yok, izleme listesinden çıkarıldı
 * (dört .ttf kaldı).
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

const FONT_PACKAGE_ROOT = path.join(process.cwd(), "node_modules/@expo-google-fonts/ibm-plex-mono");

const FONT_RELATIVE_PATHS = [
  "400Regular/IBMPlexMono_400Regular.ttf",
  "500Medium/IBMPlexMono_500Medium.ttf",
  "600SemiBold/IBMPlexMono_600SemiBold.ttf",
  "700Bold/IBMPlexMono_700Bold.ttf",
] as const;

let fontsRegistered = false;

/**
 * Her çağrıda yeniden diske bakmamak için process ömrü boyunca bir kez
 * çalışır (Next.js Node runtime'da modül instance'ı süreç boyunca canlı
 * kalır). Dosya eksikse veya kayıt başarısızsa AÇIKÇA fırlatır — sessiz
 * fallback yok (CLAUDE.md §0.1 madde 3).
 */
function registerFonts(): void {
  if (fontsRegistered) return;
  for (const rel of FONT_RELATIVE_PATHS) {
    const fullPath = path.join(FONT_PACKAGE_ROOT, rel);
    let ok: boolean;
    try {
      ok = GlobalFonts.registerFromPath(fullPath, CARD_FONT_FAMILY);
    } catch (err) {
      throw new ShareCardServerExportError(
        `Font dosyası okunamadı: ${fullPath} — orijinal hata: ` +
          `${err instanceof Error ? err.message : String(err)}`,
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
