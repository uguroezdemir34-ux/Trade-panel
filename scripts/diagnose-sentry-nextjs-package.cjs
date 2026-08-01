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

  // — Önceki koşuda require.resolve() düz Node çalıştığı için "node" koşulunu
  // eşleştirdi, webpack'in client build'de kullandığı "browser" koşulundaki
  // dosyayı DEĞİL — bu yüzden burada o dosyaları (package.json'daki
  // exports["."]["browser"] alanından bilinen gerçek yollar) doğrudan
  // diskten okuyoruz.
  function grepWithContext(filePath, patterns, contextLines = 2) {
    if (!fs.existsSync(filePath)) {
      console.log(`  (dosya yok: ${filePath})`);
      return;
    }
    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    let anyMatch = false;
    lines.forEach((line, i) => {
      if (patterns.some((p) => line.includes(p))) {
        anyMatch = true;
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length, i + contextLines + 1);
        console.log(`  [L${i + 1} civarı]`);
        for (let j = start; j < end; j++) {
          const marker = j === i ? ">> " : "   ";
          console.log(`    ${marker}L${j + 1}: ${lines[j].slice(0, 300)}`);
        }
      }
    });
    if (!anyMatch) console.log("  (eşleşme yok)");
  }

  const nextjsRoot = path.join(process.cwd(), "node_modules", "@sentry", "nextjs");

  section('@sentry/nextjs GERÇEK "browser" koşullu client giriş dosyası — ESM (build/esm/index.client.js) içinde "replayIntegration"/"Replay" arama');
  grepWithContext(path.join(nextjsRoot, "build", "esm", "index.client.js"), ["replayIntegration", "Replay"]);

  section('@sentry/nextjs GERÇEK "browser" koşullu client giriş dosyası — CJS (build/cjs/index.client.js) içinde "replayIntegration"/"Replay" arama');
  grepWithContext(path.join(nextjsRoot, "build", "cjs", "index.client.js"), ["replayIntegration", "Replay"]);

  // instrumentation-client.ts webpack tarafından ESM olarak islenir - ESM
  // client giriş dosyası hangi ALT modülden re-export yapıyorsa (ör.
  // "@sentry/react" veya "@sentry/browser" üzerinden mi, yoksa doğrudan
  // "@sentry/replay"den mi) onu bulmak için ESM dosyasındaki tüm
  // "from \"@sentry/..." import/export satırlarını listele.
  section('build/esm/index.client.js içindeki TÜM "@sentry/*" re-export/import satırları (replayIntegration\'ın hangi ara paketten geldiğini izlemek için)');
  const esmClientPath = path.join(nextjsRoot, "build", "esm", "index.client.js");
  if (fs.existsSync(esmClientPath)) {
    const esmLines = fs.readFileSync(esmClientPath, "utf8").split("\n");
    esmLines.forEach((line, i) => {
      if (/from\s+["']@sentry\//.test(line)) {
        console.log(`  L${i + 1}: ${line.trim().slice(0, 300)}`);
      }
    });
  } else {
    console.log("  (dosya yok)");
  }
} catch (err) {
  console.error("HATA:", err.message);
  process.exit(1);
}
