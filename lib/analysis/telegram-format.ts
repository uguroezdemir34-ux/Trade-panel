/**
 * AI SENARYO — Telegram sendPhoto caption formatlayıcı.
 *
 * AIScoreResult (lib/analysis/score.ts) + SrLevels (lib/sr/detect.ts) +
 * symbol + currentPrice'tan, sendTelegramPhoto'nun caption alanına
 * DOĞRUDAN verilebilecek, escape edilmiş bir MarkdownV2 metni üretir.
 * Deterministik — hiçbir LLM/API çağrısı YAPMAZ, sadece string birleştirme.
 *
 * TASARIM: önce ham (escape edilmemiş) satırlar diziye toplanır, SONRA
 * TEK SEFERDE escapeMarkdownV2() ile escape edilir (kullanıcı kararı) —
 * bold()/italic() gibi entity-bazlı helper'lar BİLEREK kullanılmadı, bu
 * yüzden çıktıda MarkdownV2 formatlaması (kalın/italik) yok, sadece düz
 * escape edilmiş metin.
 *
 * 1000 karakter sınırı (Telegram sendPhoto caption limiti 1024, güvenlik
 * payı): satır bazlı düşürme ile uygulanıyor, HAM STRING KIRPMA DEĞİL —
 * escape edilmiş bir MarkdownV2 metnini karakter sayısına göre ortadan
 * kesmek bir "\" escape çiftini ikiye bölebilir (bozuk MarkdownV2 →
 * Telegram "can't parse entities" hatası). Bunun yerine opsiyonel satırlar
 * (S/R, sonra breakdown) sondan başlayarak BÜTÜN satır halinde çıkarılıyor
 * — başlık/skor/disclaimer her zaman kalır.
 */

import type { AIScoreResult } from "@/lib/analysis/score";
import type { SrLevels } from "@/lib/sr/detect";
import { escapeMarkdownV2 } from "@/lib/notify/telegram/escape";

const CAPTION_CHAR_LIMIT = 1000;

/** Yön eşikleri — dosyada sabit, hiçbir dış çağrı yok. */
function directionLabel(score: number): string {
  if (score >= 60) return "Boğa eğilimli";
  if (score <= 40) return "Ayı eğilimli";
  return "Nötr";
}

/** +/- işaretli sayı metni — negatifler zaten "-" içeriyor, sadece pozitif/sıfıra "+" ekleniyor. */
function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function formatAIScenarioCaption(
  symbol: string,
  currentPrice: number,
  score: AIScoreResult,
  srLevels: SrLevels,
): string {
  // Her zaman kalan çekirdek satırlar (1-3 + 7).
  const headLines = [
    `🤖 AI Senaryo — ${symbol} (4H)`,
    `Güncel Fiyat: $${currentPrice}`,
    `Skor: ${score.score}/100 (${directionLabel(score.score)})`,
  ];
  const disclaimerLine = [score.disclaimer];

  // Opsiyonel: S/R (4-5) — veri yoksa satır tamamen atlanır.
  const srLines: string[] = [];
  if (srLevels.nearest_resistance) {
    const r = srLevels.nearest_resistance;
    srLines.push(`Direnç: $${r.price} (%${r.distance_pct} uzak)`);
  }
  if (srLevels.nearest_support) {
    const s = srLevels.nearest_support;
    srLines.push(`Destek: $${s.price} (%${s.distance_pct} uzak)`);
  }

  // Opsiyonel: breakdown (6).
  const breakdownLines = [
    `Trend: ${signed(score.breakdown.trendAlignment)}`,
    `RSI: ${signed(score.breakdown.rsiPosition)}`,
    `S/R: ${signed(score.breakdown.srProximity)}`,
  ];

  // Düşürme sırası: önce S/R, sonra breakdown — çekirdek (head+disclaimer) hiç düşürülmez.
  const optionalBlocks = [srLines, breakdownLines];
  while (
    optionalBlocks.some((b) => b.length > 0) &&
    escapeMarkdownV2([...headLines, ...srLines, ...breakdownLines, ...disclaimerLine].join("\n")).length >
      CAPTION_CHAR_LIMIT
  ) {
    const block = optionalBlocks.find((b) => b.length > 0);
    if (!block) break;
    block.length = 0;
  }

  const rawText = [...headLines, ...srLines, ...breakdownLines, ...disclaimerLine].join("\n");
  let escaped = escapeMarkdownV2(rawText);

  // GÜVENLİK AĞI — opsiyonel bloklar tamamen düşürüldükten sonra bile
  // limit aşılıyorsa (çekirdek: başlık+skor+disclaimer tek başına çok
  // büyükse — normal kullanımda olmamalı, disclaimer sabit kısa, ama
  // sentetik/uç girdilerde mümkün). escapeMarkdownV2 worst-case 2x
  // büyütüyor (her karakter özel karakterse "\" + ch = 2 karakter,
  // bkz. lib/notify/telegram/escape.ts) — bu yüzden 0.5 oranı MATEMATİKSEL
  // GARANTİ veriyor (0.7/1.4x gibi "kabaca" bir oran vermiyor).
  if (escaped.length > CAPTION_CHAR_LIMIT) {
    console.warn(
      "[telegram-format] core text exceeds CAPTION_CHAR_LIMIT after dropping all optional blocks, hard-truncating",
    );
    const safeRawLength = Math.floor(CAPTION_CHAR_LIMIT * 0.5);
    escaped = escapeMarkdownV2(rawText.slice(0, safeRawLength));
  }

  return escaped;
}
