/**
 * KATEGORİ TANIMLARI — saf sabit + tip, React importu / "use client" / JSX
 * YOK. Bu dosya hem tarayıcıda (components/karar/ScoreBreakdown.tsx) hem
 * sunucuda (lib/share/renderShareCard.ts → exportShareCardServer.ts,
 * Node/@napi-rs/canvas) okunuyor — bir istemci bileşeninin içinde
 * yaşayamaz, sunucu tarafı bir "use client" dosyasını import edemez.
 *
 * Kaynak taşıma, İÇERİK DEĞİŞMEDİ — ScoreBreakdown.tsx artık buradan
 * import edip geriye dönük uyumluluk için yeniden export ediyor.
 */

import type { ScoreSubScores } from "./orchestrator";

export const CATEGORIES: Array<{
  // macroBreakdown eklendiğinden beri ScoreSubScores'un tamamı sayısal değil
  // (bkz. orchestrator.ts) — bar grafiği sadece sayısal alanları listeler.
  key: Exclude<keyof ScoreSubScores, "macroBreakdown">;
  labelKey: string;
  max: number;
}> = [
  { key: "trend", labelKey: "score.categories.trend", max: 25 },
  { key: "adx", labelKey: "score.categories.adx", max: 15 },
  { key: "rsi", labelKey: "score.categories.rsi", max: 10 },
  { key: "vol", labelKey: "score.categories.vol", max: 15 },
  { key: "bb", labelKey: "score.categories.bb", max: 10 },
  { key: "vwap", labelKey: "score.categories.vwap", max: 10 },
  { key: "funding", labelKey: "score.categories.funding", max: 8 },
  { key: "macro", labelKey: "score.categories.macro", max: 7 },
];
