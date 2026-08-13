/**
 * ANLATIM KATMANI — checkHumanTraderApproval()'ın SAYISAL sonucunu
 * profesyonel Türkçe düz metne çevirir. AI SADECE ANLATIYOR, KARAR VERMİYOR
 * — approved/reddedildi kararı zaten lib/signal/humanTraderCheck.ts'te
 * tamamen deterministik verildi, bu dosya hiçbir sayıyı değiştirmez/uydurmaz,
 * sadece verilenleri insan diline döker.
 *
 * BİLEREK stop/TP1/TP2 FİYAT DEĞERLERİNİ AI'YA VERMİYOR (sadece R:R
 * ORANINI) — bu narration TEK bir çağrıyla üretilip hem VIP hem halka açık
 * kanala gönderiliyor (bkz. app/api/telegram/signal/route.ts), ve
 * TELEGRAM_VIP_CHAT_ID/TELEGRAM_PUBLIC_CHAT_ID ayrımı "TP/SL/giriş/R:R
 * (fiyat değeri) = İŞLEM TALİMATI, halka açık kanala hiç gitmez" kuralına
 * tabi (route.ts dosya başı yorumu). AI'ya hiç verilmeyen bir sayı hiçbir
 * zaman metne sızamaz — VIP'in gördüğü stop/TP fiyat DEĞERLERİ ayrıca,
 * lib/notify/telegram/formatter.ts'in DETERMİNİSTİK (AI'sız) sayısal
 * bloğuyla ekleniyor, sadece VIP metnine.
 *
 * Best-effort: ANTHROPIC_API_KEY yoksa veya çağrı başarısız olursa null
 * döner — çağıran taraf (Telegram gönderimi) düz sayısal formata düşmeli
 * (bkz. entegrasyon notları), sessizce hata yutulmaz ama akışı da
 * BLOKLAMAZ.
 *
 * Çizim/kart YOK — bu turun kapsamı sadece düz metin (kullanıcı kararı,
 * görsel katman 2. tur).
 */

import { callAnthropicText, isAnthropicConfigured } from "./anthropicClient";
import type { HumanTraderCheckResult } from "@/lib/signal/humanTraderCheck";

export interface NarrateSignalContext {
  pair: string;
  direction: "LONG" | "SHORT";
  score: number;
  price: number;
}

const SYSTEM_PROMPT = `Sen QUANTIX OS'un GO sinyali özetleyicisisin.
Sana verilen deterministik kontrol sonuçlarını (destek/direnç mesafesi,
hacim oranı, risk/ödül ORANI) profesyonel bir trader diliyle, kısa (en
fazla 4-5 satır) özetle.

KURALLAR:
- SADECE verilen sayıları anlat — yeni bir sayı UYDURMA.
- Sana stop/TP FİYAT DEĞERİ verilmiyor (bilerek) — sadece R:R oranı
  veriliyor, bir fiyat seviyesi UYDURMA veya tahmin etme.
- Yeni bir yorum/tavsiye/olasılık EKLEME — karar zaten verildi, sen sadece
  anlatıyorsun.
- "Alım/satım tavsiyesi değildir" gibi bir uyarı EKLEME (mesajın geri
  kalanında zaten var).
- Türkçe yaz, emoji kullanma (mesaj formatı ayrıca ekliyor).`;

/**
 * @returns Düz metin özet, veya (yapılandırılmamış/başarısız) null.
 */
export async function narrateHumanTraderCheck(
  ctx: NarrateSignalContext,
  check: HumanTraderCheckResult,
): Promise<string | null> {
  if (!isAnthropicConfigured()) return null;

  const userMessage = buildUserMessage(ctx, check);
  try {
    const text = await callAnthropicText(SYSTEM_PROMPT, userMessage, { maxTokens: 220 });
    return text.trim();
  } catch (err) {
    console.error("[narrateHumanTraderCheck] Anthropic call failed:", err);
    return null;
  }
}

function buildUserMessage(ctx: NarrateSignalContext, check: HumanTraderCheckResult): string {
  const { srCheck, volumeCheck, rrCheck } = check;
  const lines: string[] = [
    `Parite: ${ctx.pair} ${ctx.direction} @ ${ctx.price}`,
    `Skor: ${ctx.score}/100`,
    "",
    "Destek/Direnç:",
    srCheck.nearestResistance
      ? `  Direnç: ${srCheck.nearestResistance.price} (%${srCheck.nearestResistance.distance_pct.toFixed(2)} uzakta, güç ${srCheck.nearestResistance.strength})`
      : "  Direnç: yakında yok",
    srCheck.nearestSupport
      ? `  Destek: ${srCheck.nearestSupport.price} (%${srCheck.nearestSupport.distance_pct.toFixed(2)} uzakta, güç ${srCheck.nearestSupport.strength})`
      : "  Destek: yakında yok",
    `  Hacim-teyitli kırılım: ${srCheck.breakoutConfirmed ? "evet" : "hayır"}`,
    "",
    `Hacim oranı: ${volumeCheck.volRatio !== null ? `${volumeCheck.volRatio.toFixed(2)}x` : "bilinmiyor"}`,
    "",
    // Stop/TP1/TP2 FİYAT DEĞERLERİ BİLEREK VERİLMİYOR — bkz. dosya başı
    // yorumu (halka açık kanala sızma riski, tek narration iki kanala da
    // gidiyor).
    rrCheck.rr1 !== null
      ? `Risk/Ödül oranı: ${rrCheck.rr1.toFixed(2)}`
      : "Risk/Ödül oranı hesaplanamadı (yetersiz veri)",
  ];
  return lines.join("\n");
}
