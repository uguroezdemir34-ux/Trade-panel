#!/usr/bin/env node
/**
 * READ-ONLY teşhis — @sentry/nextjs paketinin exports/sideEffects alanlarını
 * ve replayIntegration'ın instrumentation-client.ts'nin statik "import *"
 * grafiğine hangi dosyadan/mekanizmayla girdiğini raporlar.
 *
 * Hiçbir dosyayı değiştirmez, sadece node_modules'ı okur. package.json
 * dosyaları doğrudan diskten okunuyor (require() değil) — bazı paketlerin
 * "exports" alanı "./package.json" subpath'ini dışarı açmayabiliyor, o
 * durumda require.resolve() ERR_PACKAGE_PATH_NOT_EXPORTED atar; doğrudan
 * dosya okuma bu kısıtlamayı by-pass eder.
 */
const fs = require("fs");
const path = require("path");

function section(title) {
  console.log("");
  console.log(`--- ${title} ---`);
}

function readPkgJsonFromDisk(relDir) {
  const p = path.join(process.cwd(), "node_modules", relDir, "package.json");
  if (!fs.existsSync(p)) return null;
  return { path: p, pkg: JSON.parse(fs.readFileSync(p, "utf8")) };
}

try {
  section("@sentry/nextjs package.json (diskten doğrudan okuma)");
  const nextjsPkgInfo = readPkgJsonFromDisk("@sentry/nextjs");
  if (!nextjsPkgInfo) {
    console.log("(node_modules/@sentry/nextjs/package.json bulunamadı)");
  } else {
    console.log("yol:", nextjsPkgInfo.path);
    const p = nextjsPkgInfo.pkg;
    console.log(JSON.stringify({
      name: p.name, version: p.version, main: p.main, module: p.module,
      browser: p.browser, sideEffects: p.sideEffects, exports: p.exports,
    }, null, 2));
  }

  section("'@sentry/nextjs' require.resolve() gerçek giriş dosyası");
  let resolvedEntry = null;
  try {
    resolvedEntry = require.resolve("@sentry/nextjs");
    console.log(resolvedEntry);
  } catch (err) {
    console.log("require.resolve başarısız:", err.message);
  }

  if (resolvedEntry) {
    section(`${resolvedEntry} içinde "replayIntegration" arama`);
    const entryContent = fs.readFileSync(resolvedEntry, "utf8");
    const lines = entryContent.split("\n");
    let found = false;
    lines.forEach((line, i) => {
      if (line.includes("replayIntegration")) {
        found = true;
        console.log(`  L${i + 1}: ${line.trim().slice(0, 200)}`);
      }
    });
    if (!found) {
      console.log("  (bu dosyada doğrudan 'replayIntegration' string'i geçmiyor — başka bir dosyadan re-export ediliyor olabilir)");
    }
  }

  section("@sentry/replay package.json (diskten doğrudan okuma)");
  const replayPkgInfo = readPkgJsonFromDisk("@sentry/replay");
  if (!replayPkgInfo) {
    console.log("(node_modules/@sentry/replay/package.json bulunamadı — top-level'da yok, iç içe/nested olabilir)");
  } else {
    console.log("yol:", replayPkgInfo.path);
    const p = replayPkgInfo.pkg;
    console.log(JSON.stringify({
      name: p.name, version: p.version, main: p.main, module: p.module,
      sideEffects: p.sideEffects, exports: p.exports,
    }, null, 2));
  }

  section("instrumentation-client.ts'nin gerçek import satırı (repo kökünden)");
  const instrPath = path.join(__dirname, "..", "instrumentation-client.ts");
  const instrContent = fs.readFileSync(instrPath, "utf8");
  const importLine = instrContent.split("\n").find(
    (l) => l.includes('from "@sentry/nextjs"') || l.includes("from '@sentry/nextjs'"),
  );
  console.log(importLine ?? "(bulunamadı)");

  section("loadSentryReplay() içindeki dinamik import satırı");
  const dynamicImportLine = instrContent.split("\n").find((l) => l.includes("await import("));
  console.log(dynamicImportLine ?? "(bulunamadı)");
} catch (err) {
  console.error("HATA:", err.message);
  process.exit(1);
}
