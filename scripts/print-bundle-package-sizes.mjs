#!/usr/bin/env node
/**
 * .next/analyze/*.html (webpack-bundle-analyzer static report) icindeki
 * gomulu "chartData" agacini okuyup npm paketi basina toplam boyutu
 * CI log'una duz metin olarak yazar.
 *
 * Neden burada: bu sandbox'ta node_modules yok / npm install engelli,
 * ve CI'nin urettigi artifact zip'i de sandbox proxy'si tarafindan
 * engelleniyor (blob storage indirme linki 403). Ama CI job log'u
 * ayri bir kanaldan (GitHub API) okunabiliyor - bu script analiz
 * sonucunu o kanaldan okunabilecek duz metne cevirir.
 *
 * chartData formati (@next/bundle-analyzer -> webpack-bundle-analyzer
 * 4.10.1, static mod): rapor HTML'i "window.chartData = [...]" olarak
 * bir agac gomer - her dugum {label, statSize, parsedSize, gzipSize,
 * groups?} seklinde, groups yoksa dugum bir yapraktir (gercek modul).
 * Yaprağa kadar olan label'lar path segmentleri - node_modules'ten
 * sonraki ilk (scoped ise iki) segment npm paket adidir.
 */

import { readFileSync } from "node:fs";

const filePath = process.argv[2] ?? ".next/analyze/client.html";
const topN = Number(process.argv[3] ?? 20);

function extractChartDataJson(html) {
  const marker = "chartData";
  const idx = html.lastIndexOf(marker);
  if (idx === -1) return null;
  const eq = html.indexOf("=", idx);
  if (eq === -1) return null;
  let start = eq + 1;
  while (start < html.length && /\s/.test(html[start])) start++;
  if (html[start] !== "[") return null;

  let depth = 0;
  let inString = false;
  let stringChar = "";
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        return html.slice(start, i + 1);
      }
    }
  }
  return null;
}

function sizeOf(node) {
  if (typeof node.parsedSize === "number") return node.parsedSize;
  if (typeof node.statSize === "number") return node.statSize;
  return 0;
}

function packageNameFromPath(fullPath) {
  const lastIdx = fullPath.lastIndexOf("node_modules/");
  if (lastIdx === -1) return null;
  const rest = fullPath.slice(lastIdx + "node_modules/".length);
  const segments = rest.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  if (segments[0].startsWith("@") && segments.length > 1) {
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0];
}

function main() {
  let html;
  try {
    html = readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`[bundle-sizes] HATA: dosya okunamadi: ${filePath} (${err.message})`);
    process.exit(1);
  }

  const jsonText = extractChartDataJson(html);
  if (!jsonText) {
    console.error(`[bundle-sizes] HATA: "chartData" atamasi ${filePath} icinde bulunamadi veya parse edilemedi - format bekledigimizden farkli olabilir.`);
    process.exit(1);
  }

  let roots;
  try {
    roots = JSON.parse(jsonText);
  } catch (err) {
    console.error(`[bundle-sizes] HATA: chartData JSON.parse basarisiz: ${err.message}`);
    process.exit(1);
  }
  if (!Array.isArray(roots)) {
    console.error(`[bundle-sizes] HATA: chartData bir dizi degil (tip: ${typeof roots}) - beklenmedik format.`);
    process.exit(1);
  }

  const byPackage = new Map();
  const byAppCode = { size: 0, count: 0 };
  let leafCount = 0;
  let totalSize = 0;

  function walk(node, pathSoFar) {
    const label = typeof node.label === "string" ? node.label : "";
    const fullPath = pathSoFar ? `${pathSoFar}/${label}` : label;
    const children = Array.isArray(node.groups) ? node.groups : Array.isArray(node.children) ? node.children : null;

    if (!children || children.length === 0) {
      leafCount++;
      const size = sizeOf(node);
      totalSize += size;
      const pkg = packageNameFromPath(fullPath);
      if (pkg) {
        byPackage.set(pkg, (byPackage.get(pkg) ?? 0) + size);
      } else {
        byAppCode.size += size;
        byAppCode.count++;
      }
      return;
    }
    for (const child of children) walk(child, fullPath);
  }

  for (const root of roots) walk(root, "");

  if (leafCount === 0) {
    console.error("[bundle-sizes] HATA: agacta hic yaprak (gercek modul) bulunamadi - chartData bos ya da beklenmedik sekilde ic ice.");
    process.exit(1);
  }

  const sorted = [...byPackage.entries()].sort((a, b) => b[1] - a[1]);

  const fmtKb = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

  console.log(`[bundle-sizes] Kaynak: ${filePath}`);
  console.log(`[bundle-sizes] Toplam olculen modul (yaprak) sayisi: ${leafCount}, toplam boyut: ${fmtKb(totalSize)}`);
  console.log(`[bundle-sizes] node_modules disi (uygulama kodu) toplam: ${fmtKb(byAppCode.size)} (${byAppCode.count} modul)`);
  console.log(`[bundle-sizes] En buyuk ${Math.min(topN, sorted.length)} npm paketi (parsedSize/statSize toplami, azalan):`);
  sorted.slice(0, topN).forEach(([pkg, size], i) => {
    console.log(`[bundle-sizes] ${String(i + 1).padStart(2, " ")}. ${pkg.padEnd(40, " ")} ${fmtKb(size)}`);
  });
}

main();
