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
 * ibm-plex-mono kullanıyor (app/karar/layout.tsx — perf teşhisinde root
 * layout'tan buraya taşındı, tek çağıran ShareButton.tsx zaten sadece
 * /karar'da) — bu iki paket IBM Plex
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
 *
 * Logo — public/quantix-logo.png, aynı process.cwd() tabanlı sabit fs yolu
 * ve aynı outputFileTracingIncludes deseni (bkz. next.config.ts): public/
 * klasörü Next'in statik CDN sunumu için ayrı işleniyor, serverless
 * fonksiyonun kendi fs'inden otomatik erişilebilir DEĞİL — font dosyalarıyla
 * aynı sınıf sorun, aynı çözüm.
 *
 * REFACTOR NOTU: font kayıt mantığının kendisi (FONT_PACKAGE_ROOT,
 * FONT_RELATIVE_PATHS, fontsRegistered flag, CARD_FONT_FAMILY) artık bu
 * dosyada değil, lib/share/fonts.ts'te (registerCardFonts()) — hem bu
 * dosya hem exportScenarioChartServer.ts oradan çağırıyor, aynı süreçte
 * ikisi de çalışsa bile TEK flag sayesinde font iki kez kaydedilmiyor.
 * Yukarıdaki dosya yolları/gerekçe yorumları hâlâ geçerli, sadece
 * uygulaması taşındı.
 */

import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  renderShareCard,
  SHARE_CARD_SIZE,
  type ShareCardData,
  type ShareCanvasContext,
  type ShareImageSource,
} from "./renderShareCard";
import { registerCardFonts } from "./fonts";

export class ShareCardServerExportError extends Error {}

const LOGO_PATH = path.join(process.cwd(), "public/quantix-logo.png");

let cachedLogoImage: ShareImageSource | null = null;

/** Süreç ömrü boyunca bir kez yüklenir (fontsRegistered ile aynı gerekçe).
 *  Dosya bulunamazsa/okunamazsa AÇIKÇA fırlatır — sessiz fallback yok. */
async function loadLogoImage(): Promise<ShareImageSource> {
  if (cachedLogoImage) return cachedLogoImage;
  try {
    cachedLogoImage = await loadImage(LOGO_PATH);
  } catch (err) {
    throw new ShareCardServerExportError(
      `Logo yüklenemedi: ${LOGO_PATH} — orijinal hata: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return cachedLogoImage;
}

export async function exportShareCardPngServer(data: ShareCardData): Promise<Buffer> {
  registerCardFonts();
  const logoImage = await loadLogoImage();

  const canvas = createCanvas(SHARE_CARD_SIZE, SHARE_CARD_SIZE);
  const ctx = canvas.getContext("2d");

  // Dar cast — bkz. renderShareCard.ts'teki ShareCanvasContext yorumu ve
  // exportShareCard.ts'teki aynı cast (tarayıcı tarafı) için gerekçe.
  renderShareCard(ctx as unknown as ShareCanvasContext, data, logoImage);

  return canvas.toBuffer("image/png");
}
