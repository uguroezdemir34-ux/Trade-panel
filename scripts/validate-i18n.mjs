/**
 * QUANTIX OS — Çift Katmanlı i18n Doğrulama (Node.js saf JS)
 *
 * Katman 1: Tüm dil dosyaları aynı key yapısına sahip mi?
 * Katman 2: Finansal terminoloji global standartlara uygun mu?
 *
 * Çalıştırma: node scripts/validate-i18n.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const I18N_DIR = join(__dirname, "../lib/i18n");

const LOCALES = ["en", "tr", "de", "fr", "es", "pt", "zh", "ja", "ko", "ru", "ar", "hi"];

// ── Dosya okuyucu + key çıkarıcı ─────────────────────────────────

function readLocale(locale) {
  const src = readFileSync(join(I18N_DIR, `${locale}.ts`), "utf-8");
  return src;
}

/**
 * TS kaynak kodundan "key: value" çiftlerini düzleştirilmiş path olarak çıkar.
 * Yalnızca string değerleri (leaf node) alır.
 */
function extractFlatKeys(src) {
  // Remove comments
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

  const keys = [];
  const stack = [];

  // Tokenize: track object opens/closes and key-value lines
  const lines = clean.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();

    // Object close — pop stack
    if (trimmed.startsWith("},") || trimmed === "};" || trimmed === "}") {
      stack.pop();
      continue;
    }

    // Object open: `key: {` or `"key": {`
    const objMatch = trimmed.match(/^"?([a-zA-Z_$][a-zA-Z0-9_$]*)"?\s*:\s*\{/);
    if (objMatch) {
      stack.push(objMatch[1]);
      continue;
    }

    // Leaf value: `key: "value",`
    const leafMatch = trimmed.match(/^"?([a-zA-Z_$"][a-zA-Z0-9_$"]*)"?\s*:\s*"([^"]*)"/);
    if (leafMatch) {
      const key = leafMatch[1].replace(/"/g, "");
      const value = leafMatch[2];
      const path = [...stack, key].join(".");
      keys.push({ path, value });
      continue;
    }
  }

  return keys;
}

function extractValue(keys, path) {
  const found = keys.find((k) => k.path === path);
  return found ? found.value : undefined;
}

// ── Katman 1: Yapısal kontrol ─────────────────────────────────────

function layer1(parsed) {
  const errors = [];
  const warnings = [];
  const refPaths = new Set(parsed.en.map((k) => k.path));

  for (const [locale, keys] of Object.entries(parsed)) {
    if (locale === "en") continue;
    const localePaths = new Set(keys.map((k) => k.path));

    for (const path of refPaths) {
      if (!localePaths.has(path)) {
        errors.push(`[${locale.toUpperCase()}] EKSİK KEY: "${path}"`);
      }
    }

    for (const path of localePaths) {
      if (!refPaths.has(path)) {
        warnings.push(`[${locale.toUpperCase()}] FAZLA KEY: "${path}" (EN'de yok)`);
      }
    }

    for (const { path, value } of keys) {
      if (refPaths.has(path) && value === "") {
        warnings.push(`[${locale.toUpperCase()}] BOŞ DEĞER: "${path}"`);
      }
    }
  }

  return { errors, warnings };
}

// ── Katman 2: Terminoloji kontrolü ───────────────────────────────

const TERM_RULES = [
  {
    key: "sizer.bucket",
    description: '"bucket/Bucket" → Tier/Level eşdeğeri olmalı (EN hariç)',
    check: (val, locale) => {
      if (locale === "en") return true;
      return !["bucket", "Bucket", "BUCKET"].includes(val);
    },
    fix: "Tier/Level karşılığı kullanın: Nivel, Niveau, レベル, 레벨, Уровень, स्तर, المستوى",
  },
  {
    key: "position.liqPrice",
    description: '"TAS" geçersiz — LIQ veya yerel "tasfiye fiyatı" olmalı',
    check: (val) => val !== "TAS",
    fix: "LIQ veya dile özgü tasfiye fiyatı ifadesi kullanın",
  },
  {
    key: "pnl.summary.allTime",
    description: '"All time / كل الأوقات" → kümülatif/toplam ifadesi (EN hariç)',
    check: (val, locale) => {
      if (locale === "en") return true;
      return !["All time", "All Time", "ALL TIME", "كل الأوقات"].includes(val);
    },
    fix: "Cumulé / Gesamt / Histórico / إجمالي / 累計 / Cumulated gibi profesyonel ifadeler kullanın",
  },
  {
    key: "settings.okx.apiSecret",
    description: '"سر API" gibi çok kısa/eksik ifadeler geçersiz',
    check: (val) => !["سر API", "sر API"].includes(val),
    fix: '"API Secret" teknik terimi veya dile özgü standart kullanın',
  },
  {
    key: "nav.pnl",
    description: "Nav P&L etiketi tüm dillerde P&L olmalı",
    check: (val) => val === "P&L",
    fix: "P&L evrensel finansal kısaltmadır",
  },
  {
    key: "pnl.title",
    description: "P&L başlık P&L içermeli",
    check: (val) => val.includes("P&L"),
    fix: "P&L kısaltması başlıkta korunmalı",
  },
  {
    key: "sizer.stop",
    description: "STOP teknik terimi korunmalı",
    check: (val) => val === "STOP",
    fix: "STOP evrensel emir tipidir",
  },
  {
    key: "sizer.rr",
    description: "R:R formatı korunmalı",
    check: (val) => val === "R:R",
    fix: "R:R evrensel risk/ödül formatıdır",
  },
  {
    key: "direction.long",
    description: "LONG teknik terimi korunmalı",
    check: (val) => val === "LONG",
    fix: "LONG evrensel piyasa yönü terimidir",
  },
  {
    key: "direction.short",
    description: "SHORT teknik terimi korunmalı",
    check: (val) => val === "SHORT",
    fix: "SHORT evrensel piyasa yönü terimidir",
  },
];

function layer2(parsed) {
  const errors = [];
  const warnings = [];

  for (const rule of TERM_RULES) {
    for (const [locale, keys] of Object.entries(parsed)) {
      const val = extractValue(keys, rule.key);
      if (val === undefined) continue; // Layer 1 already catches missing keys

      if (!rule.check(val, locale)) {
        errors.push(
          `[${locale.toUpperCase()}] TERMİNOLOJİ HATASI — ${rule.key}: "${val}"\n    ↳ ${rule.description}\n    ↳ Düzeltme: ${rule.fix}`
        );
      }
    }
  }

  return { errors, warnings };
}

// ── Ana akış ─────────────────────────────────────────────────────

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  QUANTIX OS — Çift Katmanlı i18n Doğrulama               ║");
console.log(`║  ${LOCALES.length} dil · ${TERM_RULES.length} terminoloji kuralı · 3 yapısal kural         ║`);
console.log("╚══════════════════════════════════════════════════════════╝\n");

// Parse all locale files
const parsed = {};
for (const locale of LOCALES) {
  try {
    const src = readLocale(locale);
    parsed[locale] = extractFlatKeys(src);
    console.log(`  ✔ ${locale.padEnd(3)} — ${parsed[locale].length} anahtar okundu`);
  } catch (e) {
    console.error(`  ✗ ${locale} okunamadı: ${e.message}`);
    process.exit(1);
  }
}
console.log();

// Layer 1
console.log("▶ KATMAN 1 — Yapısal Kontrol (Anahtar Eşleşmesi)");
console.log("─".repeat(60));
const { errors: l1Errors, warnings: l1Warnings } = layer1(parsed);

if (l1Errors.length === 0 && l1Warnings.length === 0) {
  console.log("  ✅ Tüm 12 dil dosyası EN referansıyla birebir eşleşiyor.\n");
} else {
  for (const e of l1Errors) console.log(`  ❌ ${e}`);
  for (const w of l1Warnings) console.log(`  ⚠️  ${w}`);
  console.log();
}

// Layer 2
console.log("▶ KATMAN 2 — Terminoloji Kontrolü (10 Finansal Kural)");
console.log("─".repeat(60));
const { errors: l2Errors, warnings: l2Warnings } = layer2(parsed);

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
  console.log(`✅ KONTROL BAŞARILI — ${totalErrors} hata, ${totalWarnings} uyarı`);
  console.log("   QUANTIX OS i18n sistemi global standartlara TAM UYUMLU.");
} else {
  console.log(`❌ KONTROL BAŞARISIZ — ${totalErrors} hata, ${totalWarnings} uyarı`);
  console.log("   Yukarıdaki hataları düzeltin ve tekrar çalıştırın.");
  process.exit(1);
}
console.log("═".repeat(60));
