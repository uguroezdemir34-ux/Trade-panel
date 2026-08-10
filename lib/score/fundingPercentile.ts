/**
 * FUNDING PERSENTİL SKORLAMA — DENEYSEL TASLAK, HİÇBİR YERE BAĞLANMADI.
 *
 * ⚠️ HENÜZ HİÇBİR YERDEN ÇAĞRILMIYOR. orchestrator.ts/composeScoreInput.ts'e
 * kasıtlı olarak bağlanmadı — entegrasyon (composeScoreInput.ts'e yeni bir
 * parametre eklemek, useScoreEngine.ts'te 72 saatlik geçmişi toplayıp
 * beslemek) başka dosyalara dokunmayı gerektirir — ayrı, daha büyük bir
 * görev/onay turu.
 *
 * scorers.ts'e KASITLI OLARAK dokunulmadı, hatta import bile edilmedi — o
 * dosyanın kendi başlığında "Her eşik DEĞİŞTİRİLMEMELİ" uyarısı var (satır
 * 21), bu yüzden 8→5→2 doğrusal geçiş formülü burada BAĞIMSIZ bir kopya
 * olarak tutuluyor (aşağıdaki fallbackLinearScore), scorers.ts'in kendisine
 * hiçbir ek bağımlılık/etkiyle dokunulmuyor.
 *
 * GEREKÇE (chat'te doğrulanan bulgu düzeltmesiyle): scorers.ts'teki mevcut
 * sabit eşikler (healthy ≤%0.02, elevated %0.02-0.05, crowded %0.05-0.10)
 * WebSearch ile genel piyasa dokümantasyonuyla kabaca tutarlı bulundu — ilk
 * iddia edilen "10 kat fark" yanlıştı, gerçek fark gözlemlenen örneklemde
 * (6 saat + go_signals'taki 51 sinyal) yaklaşık 1.3-4 kat. Yine de bu dar
 * örneklemde skor hiç kademeli çıkmıyor (sürekli healthy bandında). Bu
 * dosya, MUTLAK sabit eşikler yerine SON N SAATİN GERÇEK DAĞILIMINA göre
 * relatif (persentil-tabanlı) bir alternatif deniyor — piyasa sakin ya da
 * volatil olsun, skor her zaman güncel dağılımın neresinde olduğuna göre
 * kademeli çıkar.
 *
 * EŞİT AĞIRLIKLI (chat'te karar verildi, 72 saatlik pencerede yakın-zaman
 * ağırlıklandırması YOK): İlk taslak son 8sa/8-24sa/24-72sa için sırasıyla
 * %50/%30/%20 ağırlıklı bir versiyondu. "Önce basit, ölç, sonra optimize
 * et" prensibiyle bilerek terk edildi — ağırlıklandırmanın tek gerekçesi
 * rejim değişimine hızlı tepkiydi, ama funding rejimleri (genel piyasa
 * bilgisine göre) saatler değil günler mertebesinde değişiyor; üç ekstra
 * parametre (bant sınırları + ağırlıklar) bu faydayı şu an haklı çıkarmıyor.
 * Gerekirse (go_signals'taki gerçek geçmiş veriyle ağırlıklı vs eşit-ağırlıklı
 * karşılaştırması ölçülüp fark gösterilirse) ayrı bir turda eklenebilir.
 *
 * 72 SAATLİK GEÇMİŞİ BU DOSYA TOPLAMAZ/SAKLAMAZ — lib/score/ saf
 * fonksiyonlardan oluşuyor (composeScoreInput.ts deseniyle aynı: tüm
 * girdiler caller tarafından hazırlanıp veriliyor). `history` parametresi
 * caller'ın (henüz yazılmamış) bir store/hook'tan topladığı örnekleri
 * temsil ediyor.
 */

import type { Direction } from "./direction";

export interface FundingSample {
  /** Decimal — 0.0001 = %0.01 (fetchFundingRate/fetchOkxFundingRate ile aynı birim) */
  rate: number;
  /** Örneğin şu ana göre yaşı, saat cinsinden (0 = en taze) */
  ageHours: number;
}

export interface FundingPercentileResult {
  score: number;
  reason: string;
  /** Hangi aşamada hesaplandı — teşhis/debug amaçlı, skora dahil değil. */
  stage: "cold" | "fallback" | "percentile";
}

/** Pencere dışı (72 saatten eski) örnekler dahil edilmez. */
const LOOKBACK_HOURS = 72;

/**
 * Eşit ağırlıklı persentil rank (0-100) — pencere içindeki (≤72sa) TÜM
 * örnekler eşit ağırlıkta, "current değerin altında kalan" örnek sayısının
 * toplam örnek sayısına oranı. Yakın-zaman ağırlıklandırması yok (yukarıdaki
 * GEREKÇE notuna bkz.) — basit, öngörülebilir, istatistik kütüphanesi
 * gerektirmiyor.
 */
function percentileRank(samples: FundingSample[], currentRate: number): number {
  const inWindow = samples.filter((s) => s.ageHours <= LOOKBACK_HOURS);
  if (inWindow.length === 0) return 50; // örnek yok — nötr (dağılımın tam ortası) varsay

  const belowCount = inWindow.filter((s) => s.rate < currentRate).length;
  return (belowCount / inWindow.length) * 100;
}

/**
 * scorers.ts'teki payingSideFundingScore() ile AYNI doğrusal geçiş formülü
 * (8→5→2, sınırlar %0.02/%0.05/%0.10) — BAĞIMSIZ kopya, scorers.ts import
 * edilmiyor (dosya başlığındaki "değiştirilmemeli" uyarısı nedeniyle o
 * dosyaya hiç dokunulmuyor/bağlanmıyor). Sadece 8-24 saatlik cold-start
 * fallback aşamasında kullanılıyor.
 */
function fallbackLinearScore(absFrPct: number): number {
  if (absFrPct <= 0.02) return 8;
  if (absFrPct <= 0.05) return 8 + (5 - 8) * ((absFrPct - 0.02) / (0.05 - 0.02));
  if (absFrPct <= 0.10) return 5 + (2 - 5) * ((absFrPct - 0.05) / (0.10 - 0.05));
  return 2;
}

/**
 * 3 aşamalı cold-start + eşit ağırlıklı persentil-tabanlı funding skoru
 * (deneysel).
 *
 * @param fundingRate           Şu anki ham funding oranı (decimal), null = veri yok
 * @param direction              LONG | SHORT | NEUTRAL
 * @param history                Son 72 saate ait geçmiş örnekler (caller toplar/sağlar)
 * @param oldestSampleAgeHours   En eski örneğin yaşı (saat) — cold-start aşamasını
 *                               belirlemek için history.length yerine bu kullanılıyor,
 *                               çünkü örnekleme sıklığı zamanla değişebilir.
 */
export function scoreFundingPercentile(
  fundingRate: number | null,
  direction: Direction,
  history: FundingSample[],
  oldestSampleAgeHours: number,
): FundingPercentileResult {
  if (fundingRate === null) {
    return { score: 0, reason: "N/A", stage: "cold" };
  }

  // Aşama 1 (0-8sa): yetersiz veri — nötr (0), "en dürüst" varsayılan
  // (spesifikasyonun kendi terimi) — sahte bir kademe uydurmak yerine
  // "bilmiyoruz" demek.
  if (oldestSampleAgeHours < 8) {
    return { score: 0, reason: "Yetersiz geçmiş (<8sa) — nötr", stage: "cold" };
  }

  const fr = fundingRate * 100; // percent
  const absFr = Math.abs(fr);
  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  // Aşama 2 (8-24sa): persentil güvenilmez, dar sabit fallback'e düş —
  // scorers.ts'teki scoreFunding()'in healthy/contrarian/paying yapısıyla
  // AYNI mantık, bağımsız kopya (yukarıdaki not).
  if (oldestSampleAgeHours < 24) {
    if (absFr <= 0.02) {
      return { score: 8, reason: `${fr.toFixed(3)}% (fallback healthy)`, stage: "fallback" };
    }
    if (isLong && fr < -0.02) {
      return { score: 8, reason: `${fr.toFixed(3)}% (fallback LONG contrarian)`, stage: "fallback" };
    }
    if (isShort && fr > 0.02) {
      return { score: 8, reason: `+${fr.toFixed(3)}% (fallback SHORT contrarian)`, stage: "fallback" };
    }
    if (isLong || isShort) {
      return { score: fallbackLinearScore(absFr), reason: `${fr.toFixed(3)}% (fallback paying)`, stage: "fallback" };
    }
    return { score: 5, reason: `${fr.toFixed(3)}% (fallback elevated, yön nötr)`, stage: "fallback" };
  }

  // Aşama 3 (>24sa): persentil modu — pencere 72 saate kadar kademeli
  // büyür (percentileRank sadece mevcut örnekleri kullanır, eşit ağırlıklı).
  if (!isLong && !isShort) {
    const rank = percentileRank(history, fundingRate);
    return { score: 5, reason: `P${rank.toFixed(0)} (yön nötr)`, stage: "percentile" };
  }

  const rank = percentileRank(history, fundingRate);
  // LONG için düşük persentil (fonlama son dönemin en negatiflerinde —
  // short'lar long'lara ödüyor) kontrarian/olumlu; SHORT için ayna simetrik
  // (100-rank ile aynı bantlama fonksiyonunu paylaşıyor).
  const effectiveRank = isLong ? rank : 100 - rank;

  if (effectiveRank <= 5) {
    return { score: 8, reason: `P${rank.toFixed(0)} (güçlü kontrarian)`, stage: "percentile" };
  }
  if (effectiveRank <= 15) {
    const score = 8 + (5 - 8) * ((effectiveRank - 5) / (15 - 5));
    return { score, reason: `P${rank.toFixed(0)} (orta kontrarian)`, stage: "percentile" };
  }
  if (effectiveRank <= 30) {
    const score = 5 + (2 - 5) * ((effectiveRank - 15) / (30 - 15));
    return { score, reason: `P${rank.toFixed(0)} (hafif kontrarian)`, stage: "percentile" };
  }
  if (effectiveRank < 70) {
    return { score: 8, reason: `P${rank.toFixed(0)} (healthy — dağılımın ortası)`, stage: "percentile" };
  }
  if (effectiveRank < 85) {
    const score = 8 + (5 - 8) * ((effectiveRank - 70) / (85 - 70));
    return { score, reason: `P${rank.toFixed(0)} (hafif paying)`, stage: "percentile" };
  }
  if (effectiveRank < 95) {
    const score = 5 + (2 - 5) * ((effectiveRank - 85) / (95 - 85));
    return { score, reason: `P${rank.toFixed(0)} (orta paying)`, stage: "percentile" };
  }
  return { score: 2, reason: `P${rank.toFixed(0)} (güçlü paying)`, stage: "percentile" };
}
