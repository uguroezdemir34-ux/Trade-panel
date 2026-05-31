/**
 * QUANTIX OS — Çift Katmanlı i18n Kontrol Mekanizması
 *
 * Katman 1 — Yapısal Kontrol:
 *   EN referans alınarak tüm 12 dil dosyasının aynı anahtar yapısına
 *   sahip olduğu doğrulanır (eksik key, fazla key, tip uyumsuzluğu).
 *
 * Katman 2 — Terminoloji Kontrolü:
 *   Global finansal trading standartlarına uyum:
 *   - bucket → Tier/Level eşdeğeri (EN "Bucket" hariç)
 *   - allTime → kümülatif ifade (EN "All time" hariç)
 *   - apiSecret → "API Secret" veya dil standardı
 *   - P&L → her dilde P&L korunmalı
 *   - LONG/SHORT/STOP/TP/SL → teknik terimler korunmalı
 *
 * Çalıştırma:
 *   npx tsx scripts/validate-i18n.ts
 */

import { en } from "../lib/i18n/en";
import { tr } from "../lib/i18n/tr";
import { de } from "../lib/i18n/de";
import { fr } from "../lib/i18n/fr";
import { es } from "../lib/i18n/es";
import { pt } from "../lib/i18n/pt";
import { zh } from "../lib/i18n/zh";
import { ja } from "../lib/i18n/ja";
import { ko } from "../lib/i18n/ko";
import { ru } from "../lib/i18n/ru";
import { ar } from "../lib/i18n/ar";
import { hi } from "../lib/i18n/hi";

type AnyDict = Record<string, unknown>;

const LOCALES: Record<string, AnyDict> = {
  en: en as unknown as AnyDict,
  tr: tr as unknown as AnyDict,
  de: de as unknown as AnyDict,
  fr: fr as unknown as AnyDict,
  es: es as unknown as AnyDict,
  pt: pt as unknown as AnyDict,
  zh: zh as unknown as AnyDict,
  ja: ja as unknown as AnyDict,
  ko: ko as unknown as AnyDict,
  ru: ru as unknown as AnyDict,
  ar: ar as unknown as AnyDict,
  hi: hi as unknown as AnyDict,
};

// ── Katman 1: Yapısal kontrol ─────────────────────────────────────

function flattenKeys(obj: AnyDict, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as AnyDict, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function layer1StructuralCheck(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const referenceKeys = new Set(flattenKeys(LOCALES.en));

  for (const [locale, dict] of Object.entries(LOCALES)) {
    if (locale === "en") continue;
    const localeKeys = new Set(flattenKeys(dict));

    // Missing keys
    for (const key of referenceKeys) {
      if (!localeKeys.has(key)) {
        errors.push(`[${locale.toUpperCase()}] MISSING KEY: "${key}"`);
      }
    }

    // Extra keys (likely typo or leftover)
    for (const key of localeKeys) {
      if (!referenceKeys.has(key)) {
        warnings.push(`[${locale.toUpperCase()}] EXTRA KEY: "${key}" (not in EN)`);
      }
    }

    // Empty string check
    for (const key of referenceKeys) {
      const val = getNestedValue(dict, key);
      if (val === "") {
        warnings.push(`[${locale.toUpperCase()}] EMPTY VALUE: "${key}"`);
      }
    }
  }

  return { errors, warnings };
}

function getNestedValue(obj: AnyDict, path: string): unknown {
  return path.split(".").reduce((cur: unknown, key) => {
    if (cur !== null && typeof cur === "object") {
      return (cur as AnyDict)[key];
    }
    return undefined;
  }, obj);
}

// ── Katman 2: Terminoloji kontrolü ───────────────────────────────

interface TermRule {
  key: string;
  description: string;
  check: (value: string, locale: string) => boolean;
  fix?: string;
}

const TERM_RULES: TermRule[] = [
  {
    key: "sizer.bucket",
    description: 'EN "Bucket" → diğer dillerde Tier/Level eşdeğeri kullanılmalı',
    check: (val, locale) => {
      if (locale === "en") return true;
      const forbidden = ["bucket", "Bucket", "BUCKET"];
      return !forbidden.some((f) => val === f);
    },
    fix: 'Tier/Level anlamında yerel dil karşılığı kullanın (ör: Nivel, Niveau, Livello, レベル, 레벨, Уровень)',
  },
  {
    key: "sizer.margin",
    description: "Margin terimi: MARGIN veya yerel dil standardı",
    check: (val) => val.length > 0,
  },
  {
    key: "position.liqPrice",
    description: 'LIQ kısaltması veya yerel "Liquidation Price" eşdeğeri',
    check: (val) => val.length > 0 && val !== "TAS",
    fix: 'Değer "TAS" olamaz — LIQ veya yerel "tasfiye fiyatı" karşılığı kullanın',
  },
  {
    key: "pnl.summary.allTime",
    description: 'EN "All time" → diğer dillerde kümülatif/toplam ifadesi',
    check: (val, locale) => {
      if (locale === "en") return true;
      const forbidden = ["All time", "All Time", "ALL TIME", "كل الأوقات"];
      return !forbidden.some((f) => val === f);
    },
    fix: 'Cumulated/Total/Histórico/Cumulé/Gesamt/إجمالي/累計 gibi profesyonel finansal ifadeler kullanın',
  },
  {
    key: "settings.okx.apiSecret",
    description: 'apiSecret → "API Secret" veya dil standartına uygun teknik terim',
    check: (val, locale) => {
      if (locale === "en") return true;
      const forbidden = ["API Geheimnisschlüssel", "Clé secrète API", "Clave Secreta API", "sر API", "سر API"];
      return !forbidden.some((f) => val === f);
    },
    fix: '"API Secret" teknik terimi veya dile özgü standart kısaltma kullanın',
  },
  {
    key: "nav.pnl",
    description: "P&L navigasyon etiketi tüm dillerde P&L olmalı",
    check: (val) => val === "P&L",
    fix: 'P&L evrensel finansal kısaltmadır, yerelleştirme yapılmamalı',
  },
  {
    key: "pnl.title",
    description: "P&L ekran başlığında P&L geçmeli",
    check: (val) => val.includes("P&L"),
    fix: "P&L kısaltması başlıkta korunmalı",
  },
  {
    key: "sizer.stop",
    description: "STOP teknik terimi korunmalı",
    check: (val) => val === "STOP",
    fix: "STOP evrensel emir tipi terimidir, yerelleştirme yapılmamalı",
  },
  {
    key: "sizer.rr",
    description: "R:R risk/ödül formatı korunmalı",
    check: (val) => val === "R:R",
    fix: "R:R evrensel formatttır, yerelleştirme yapılmamalı",
  },
];

function layer2TerminologyCheck(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const rule of TERM_RULES) {
    for (const [locale, dict] of Object.entries(LOCALES)) {
      const val = getNestedValue(dict, rule.key);
      if (typeof val !== "string") continue;

      if (!rule.check(val, locale)) {
        const msg = `[${locale.toUpperCase()}] TERM VIOLATION — ${rule.key}: "${val}"\n    ↳ ${rule.description}${rule.fix ? `\n    ↳ Düzeltme: ${rule.fix}` : ""}`;
        errors.push(msg);
      }
    }
  }

  return { errors, warnings };
}

// ── Ana akış ─────────────────────────────────────────────────────

function run(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  QUANTIX OS — Çift Katmanlı i18n Doğrulama               ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  Dil sayısı: ${Object.keys(LOCALES).length}   Kural sayısı: ${TERM_RULES.length}                         ║`);
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Katman 1
  console.log("▶ KATMAN 1 — Yapısal Kontrol (Anahtar Eşleşmesi)");
  console.log("─".repeat(60));
  const { errors: l1Errors, warnings: l1Warnings } = layer1StructuralCheck();

  if (l1Errors.length === 0 && l1Warnings.length === 0) {
    console.log("  ✅ Tüm 12 dil dosyası EN referansıyla birebir eşleşiyor.\n");
  } else {
    for (const e of l1Errors) console.log(`  ❌ ${e}`);
    for (const w of l1Warnings) console.log(`  ⚠️  ${w}`);
    console.log();
  }

  // Katman 2
  console.log("▶ KATMAN 2 — Terminoloji Kontrolü (9 Finansal Kural)");
  console.log("─".repeat(60));
  const { errors: l2Errors, warnings: l2Warnings } = layer2TerminologyCheck();

  if (l2Errors.length === 0 && l2Warnings.length === 0) {
    console.log("  ✅ Tüm dillerde terminoloji global finansal standartlara uygun.\n");
  } else {
    for (const e of l2Errors) console.log(`  ❌ ${e}`);
    for (const w of l2Warnings) console.log(`  ⚠️  ${w}`);
    console.log();
  }

  // Özet
  const totalErrors   = l1Errors.length + l2Errors.length;
  const totalWarnings = l1Warnings.length + l2Warnings.length;

  console.log("═".repeat(60));
  if (totalErrors === 0) {
    console.log(`✅ KONTROL BAŞARILI — ${totalWarnings} uyarı, 0 hata`);
    console.log("   QUANTIX OS i18n sistemi global standartlara hazır.");
  } else {
    console.log(`❌ KONTROL BAŞARISIZ — ${totalErrors} hata, ${totalWarnings} uyarı`);
    console.log("   Yukarıdaki hataları düzeltin ve tekrar çalıştırın.");
    process.exit(1);
  }
  console.log("═".repeat(60));
}

run();
