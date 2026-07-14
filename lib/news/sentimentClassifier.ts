/**
 * ANAHTAR KELİME TABANLI HABER SINIFLANDIRMASI — Pozitif/Negatif/Nötr.
 *
 * Neden hazır bir sentiment modeli (FinBERT vb.) değil: araştırma, finans-
 * ayarlı modellerin bile "ton"u algılayıp "fiyat etkisini" kaçırdığını
 * gösteriyor (bir çalışmada FinBERT'in pozitif etiketlediği başlıkların
 * %83'ü aslında pozitif katalizör değilmiş). Kripto haber başlıkları ise
 * daha formülaik bir olay-kelime dağarcığı kullanıyor (hack/lawsuit/exploit
 * = net negatif; approval/partnership/listing = net pozitif) — bu yüzden
 * kaba ama şeffaf bir olay-tipi triyajı, nüanslı ton analizinden daha
 * dürüst bir çözüm. Eşleşme yoksa (veya berabere) varsayılan Nötr.
 *
 * Saf fonksiyon — I/O yok, skor motoruna hiç dokunmaz.
 */

import type { NewsSentiment } from "./types";

const NEGATIVE_KEYWORDS: readonly string[] = [
  "hack", "hacked", "hacker", "exploit", "exploited", "drained", "drainer",
  "stolen", "theft", "rug pull", "rugpull", "lawsuit", "sues", "sued",
  "charged", "charges", "fraud", "ponzi", "scam", "delist", "delisting",
  "bankruptcy", "bankrupt", "insolvent", "insolvency", "halts withdrawals",
  "freezes withdrawals", "collapse", "collapses", "plunge", "plunges",
  "crash", "crashes", "liquidated", "liquidation", "indicted",
  "investigation", "probe", "banned", "restricts", "sell-off", "selloff",
  "dumps", "outflow", "outflows", "warns", "warning",
];

const POSITIVE_KEYWORDS: readonly string[] = [
  "approval", "approved", "approves", "launch", "launches", "launched",
  "mainnet", "partnership", "partners with", "integrates", "integration",
  "adoption", "adopts", "listing", "lists", "all-time high", "rally",
  "rallies", "surge", "surges", "soar", "soars", "breakthrough", "upgrade",
  "upgrades", "expansion", "expands", "investment", "invests", "milestone",
  "record high", "inflow", "inflows",
];

function countMatches(title: string, keywords: readonly string[]): number {
  const lower = title.toLowerCase();
  return keywords.reduce((n, kw) => (lower.includes(kw) ? n + 1 : n), 0);
}

export function classifyHeadline(title: string): NewsSentiment {
  const neg = countMatches(title, NEGATIVE_KEYWORDS);
  const pos = countMatches(title, POSITIVE_KEYWORDS);
  if (neg > pos) return "negative";
  if (pos > neg) return "positive";
  return "neutral";
}
