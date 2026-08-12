/**
 * ORTAK FONT KAYIT MODÜLÜ — exportShareCardServer.ts ve
 * exportScenarioChartServer.ts'in AYRI AYRI tuttuğu registerFonts()/
 * FONT_PACKAGE_ROOT/FONT_RELATIVE_PATHS/fontsRegistered'ın tek merkeze
 * taşınmış hali (kullanıcı kararı) — TEK modül-seviyesi flag, aynı
 * süreçte iki export yolu da çalışsa font artık İKİ KEZ kaydedilmez
 * (önceki tasarımın flag ettiği, doğrulanmamış "zararsız olduğu
 * varsayılıyor" riski bu refactor ile tamamen ortadan kalkıyor).
 *
 * CARD_FONT_FAMILY BURADA DEĞİL, ./fontConstants.ts'te — bu dosya
 * @napi-rs/canvas (native, sunucu-only) import ettiği için, sadece sabiti
 * kullanmak isteyen tarayıcı-uyumlu dosyalar (renderShareCard.ts,
 * exportShareCard.ts) bu dosyayı DEĞİL fontConstants.ts'i import eder —
 * bkz. fontConstants.ts dosya başı yorumu (bundle-sızıntı riski).
 */

import path from "node:path";
import { GlobalFonts, type FontKey } from "@napi-rs/canvas";
import { CARD_FONT_FAMILY } from "./fontConstants";

export class CardFontRegistrationError extends Error {}

const FONT_PACKAGE_ROOT = path.join(process.cwd(), "node_modules/@expo-google-fonts/ibm-plex-mono");

const FONT_RELATIVE_PATHS = [
  "400Regular/IBMPlexMono_400Regular.ttf",
  "500Medium/IBMPlexMono_500Medium.ttf",
  "600SemiBold/IBMPlexMono_600SemiBold.ttf",
  "700Bold/IBMPlexMono_700Bold.ttf",
] as const;

let fontsRegistered = false;

/**
 * Süreç ömrü boyunca bir kez çalışır (Next.js Node runtime'da modül
 * instance'ı süreç boyunca canlı kalır). Dosya eksikse veya kayıt
 * başarısızsa AÇIKÇA fırlatır — sessiz fallback yok (CLAUDE.md §0.1
 * madde 3).
 */
export function registerCardFonts(): void {
  if (fontsRegistered) return;
  for (const rel of FONT_RELATIVE_PATHS) {
    const fullPath = path.join(FONT_PACKAGE_ROOT, rel);
    // @napi-rs/canvas 0.1.100'ün gerçek dönüş tipi boolean değil, FontKey|null
    // (exportShareCardServer.ts'teki orijinal CI doğrulamasıyla aynı gerekçe).
    let ok: FontKey | null;
    try {
      ok = GlobalFonts.registerFromPath(fullPath, CARD_FONT_FAMILY);
    } catch (err) {
      throw new CardFontRegistrationError(
        `Font dosyası okunamadı: ${fullPath} — orijinal hata: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!ok) {
      throw new CardFontRegistrationError(
        `GlobalFonts.registerFromPath() ${fullPath} için null döndü — font kaydı başarısız.`,
      );
    }
  }
  fontsRegistered = true;
}
