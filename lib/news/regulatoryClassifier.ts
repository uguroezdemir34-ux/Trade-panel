/**
 * REGÜLASYON & LİSTELEME OLAY-TİPİ SINIFLANDIRMASI — kural bazlı "Piyasa
 * Etkisi" etiketi. sentimentClassifier.ts'teki genel ton sınıflandırmasından
 * FARKLI ve bağımsız: burada amaç haberin TONU değil, olay TİPİ (borsa
 * listelemesi / dava / regülasyon güncellemesi vb.) → önceden tanımlı,
 * sabit bir etki eşlemesi (örn. "listeleme" = Pozitif, "SEC davası/
 * ertelemesi" = Negatif, "MiCA/genel regülasyon güncellemesi" = Nötr).
 *
 * KESİNLİKLE istatistiksel/tahmini veri üretmez (yüzdelik olasılık, geçmiş
 * fiyat reaksiyonu vb.) — sadece "bu olay tipi kural bazlı nasıl
 * kategorize edilir" sorusuna cevap verir, bu yüzden UI'da her zaman
 * "(kural bazlı)" etiketiyle birlikte gösterilmelidir, kesinlik iddiası
 * taşıyan bir tonla değil.
 *
 * Kısa/genel kelimelerde (sec, etf, bill) yanlış eşleşmeyi önlemek için
 * \b kelime sınırı kullanılır — düz `includes()` "second"i "sec" olarak
 * eşleştirirdi.
 *
 * Saf fonksiyon — I/O yok, skor motoruna hiç dokunmaz.
 */

import type { NewsSentiment } from "./types";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesAny(title: string, keywords: readonly string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((kw) => new RegExp(`\\b${escapeRegex(kw)}\\b`).test(lower));
}

const REGULATORY_CATEGORY_KEYWORDS: readonly string[] = [
  "sec", "cftc", "regulation", "regulatory", "regulator", "regulators",
  "mica", "compliance", "license", "licensing", "lawsuit", "sues", "sued",
  "charged", "charges", "indicted", "ban", "banned", "restricts", "delay",
  "delayed", "delays", "postpone", "postpones", "listing", "lists", "delist",
  "delisting", "framework", "legislation", "bill", "congress", "senate",
  "court", "ruling", "settlement", "fine", "fined", "penalty",
  "approval", "approved", "approves", "etf approval", "sanction", "sanctions",
];

/** Haber "regülasyon/listeleme" kategorisine giriyor mu? */
export function isRegulatoryOrListingNews(title: string): boolean {
  return matchesAny(title, REGULATORY_CATEGORY_KEYWORDS);
}

// Öncelik sırasıyla kontrol edilir — daha spesifik kalıp önce (ör. "delist"
// "listing" kuralından önce, aksi halde "delisting" içindeki "listing" alt
// dizesi yanlışlıkla Pozitif'e düşerdi).
const IMPACT_RULES: ReadonlyArray<{ keywords: readonly string[]; impact: NewsSentiment }> = [
  { keywords: ["delist", "delisting"], impact: "negative" },
  { keywords: ["listing", "lists"], impact: "positive" },
  { keywords: ["lawsuit", "sues", "sued", "charged", "charges", "indicted"], impact: "negative" },
  { keywords: ["ban", "banned", "restricts"], impact: "negative" },
  { keywords: ["sanction", "sanctions"], impact: "negative" },
  { keywords: ["delay", "delayed", "delays", "postpone", "postpones", "rejects", "rejected"], impact: "negative" },
  { keywords: ["approval", "approved", "approves", "etf approval"], impact: "positive" },
];

/**
 * Kural bazlı "Piyasa Etkisi" — eşleşme yoksa (ör. MiCA/genel regülasyon
 * güncellemesi, dava sonucu belirsiz bir settlement) varsayılan Nötr.
 */
export function classifyMarketImpact(title: string): NewsSentiment {
  for (const rule of IMPACT_RULES) {
    if (matchesAny(title, rule.keywords)) return rule.impact;
  }
  return "neutral";
}
