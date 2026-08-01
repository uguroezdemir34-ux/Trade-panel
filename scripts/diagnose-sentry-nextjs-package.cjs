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
  // Yorum satırlarını hariç tut — açıklama yorumları "eski sürüm await
  // import(...) kullanıyordu" gibi geçmiş bir referans içerebiliyor, bu da
  // gerçek kod satırı yerine yanlışlıkla o yorumu eşleştirip yanıltıcı
  // sonuç veriyordu (bu tam olarak önceki koşuda oldu).
  const dynamicImportLine = instrContent.split("\n").find(
    (l) => l.includes("await import(") && !l.trim().startsWith("//"),
  );
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

  // — Bir önceki koşu @sentry/nextjs'in client barrel'ının "export * from
  // '@sentry/react'" olduğunu gösterdi — replayIntegration @sentry/nextjs'te
  // hiç tanımlı değil, @sentry/react'ten geliyor. Şimdi AYNI ADIMI
  // @sentry/react için tekrarlıyoruz — hangi TAM PATH'in okunduğunu (kullanıcı
  // bu sandbox'ı kendisi göremediği için) HER ADIMDA açıkça yazdırıyoruz.
  function resolveBrowserEntryRelPath(pkg) {
    const exp = pkg.exports && pkg.exports["."];
    // Bazı paketlerde (ör. @sentry/react) "import"/"require" koşullarının
    // kendisi de iç içe bir obje ({types, default}) — tek seviye okumak
    // yetmiyor, string bulana kadar recursive inmek gerekiyor. (Önceki
    // koşuda bu eksiklik path.join()'e obje geçirip script'i exit code 1
    // ile çökertti — build adımı hiç başlamadı.)
    function pick(condObj) {
      if (typeof condObj === "string") return condObj;
      if (condObj && typeof condObj === "object") {
        const candidate = condObj.browser ?? condObj.import ?? condObj.require ?? condObj.default ?? condObj["react-native"];
        if (candidate === undefined) return null;
        return pick(candidate);
      }
      return null;
    }
    if (exp && typeof exp === "object" && exp.browser !== undefined) {
      const picked = pick(exp.browser);
      if (picked) return { relPath: picked, source: 'exports["."].browser' };
    }
    if (exp) {
      const picked = pick(exp);
      if (picked) return { relPath: picked, source: 'exports["."] (top-level, browser koşulu yok)' };
    }
    if (pkg.browser && typeof pkg.browser === "string") return { relPath: pkg.browser, source: "pkg.browser" };
    if (pkg.module) return { relPath: pkg.module, source: "pkg.module" };
    if (pkg.main) return { relPath: pkg.main, source: "pkg.main" };
    return null;
  }

  // Genel amaçlı: bir paketin browser-koşullu giriş dosyasını çözümleyip
  // içinde "replayIntegration"'ın İSİMLENDİRİLMİŞ (gerçek tanım/export)
  // mi yoksa yine bir "export * from ..." ile mi geçtiğini raporlar —
  // zinciri elle tekrar tekrar yazmadan bir sonraki pakete uygulanabilir.
  function tracePackageEntry(pkgName) {
    section(`${pkgName} package.json (diskten doğrudan okuma) + çözümlenen browser giriş yolu`);
    const pkgInfo = readPkgJsonFromDisk(pkgName);
    if (!pkgInfo) {
      console.log(`(node_modules/${pkgName}/package.json bulunamadı)`);
      return null;
    }
    console.log("package.json yolu:", pkgInfo.path);
    const p = pkgInfo.pkg;
    console.log(JSON.stringify({
      name: p.name, version: p.version, main: p.main, module: p.module,
      browser: p.browser, sideEffects: p.sideEffects, exports: p.exports,
    }, null, 2));

    const resolved = resolveBrowserEntryRelPath(p);
    if (!resolved) {
      console.log("UYARI: browser giriş yolu package.json'dan çözümlenemedi.");
      return null;
    }
    const pkgRoot = path.join(process.cwd(), "node_modules", ...pkgName.split("/"));
    const absPath = path.join(pkgRoot, resolved.relPath);
    console.log(`ÇÖZÜMLENEN TAM PATH (kaynak: ${resolved.source}):`);
    console.log(`  ${absPath}`);
    console.log(`Dosya var mı: ${fs.existsSync(absPath)}`);

    section(`${absPath} içinde "replayIntegration" — İSİMLENDİRİLMİŞ (gerçek) export mü, yoksa "export * from" ile mi geçiyor?`);
    if (fs.existsSync(absPath)) {
      const content = fs.readFileSync(absPath, "utf8");
      const lines = content.split("\n");
      let namedMentionFound = false;
      lines.forEach((line, i) => {
        if (line.includes("replayIntegration")) {
          console.log(`  L${i + 1}: ${line.trim().slice(0, 300)}`);
          if (!/export\s*\*\s*from/.test(line)) namedMentionFound = true;
        }
      });
      if (!content.includes("replayIntegration")) {
        console.log("  (bu dosyada 'replayIntegration' string'i hiç geçmiyor)");
      }
      console.log(`  >> SONUÇ: isimlendirilmiş (export * DIŞINDA) bir 'replayIntegration' bahsi bulundu mu: ${namedMentionFound}`);
    } else {
      console.log("  (dosya yok)");
    }

    section(`${absPath} içindeki TÜM "@sentry/*" re-export/import satırları`);
    if (fs.existsSync(absPath)) {
      const lines = fs.readFileSync(absPath, "utf8").split("\n");
      let anyMatch = false;
      lines.forEach((line, i) => {
        if (/from\s+["']@sentry\//.test(line)) {
          anyMatch = true;
          console.log(`  L${i + 1}: ${line.trim().slice(0, 300)}`);
        }
      });
      if (!anyMatch) console.log("  (eşleşme yok)");
    } else {
      console.log("  (dosya yok)");
    }
    return absPath;
  }

  tracePackageEntry("@sentry/react");
  tracePackageEntry("@sentry/browser");
} catch (err) {
  console.error("HATA:", err.message);
  process.exit(1);
}
