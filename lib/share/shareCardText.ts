/**
 * SHARE TEXT — görselle birlikte panoya kopyalanan metin (bkz.
 * ShareButton.tsx — navigator.share YOK, panoya kopyalama + PNG indirme).
 * Kartta olup metinde olmayan bir bilgi (özellikle teyit durumu), metin tek
 * başına paylaşıldığında aynı bilgi asimetrisini yaratır — bu yüzden kartla
 * BİREBİR aynı alanları taşır (kullanıcı kararı).
 *
 * Format (kullanıcı kararı — "BTC SHORT" + "NO" yan yana çelişkili
 * okunduğu için "yön" ile "verdict" ayrı satırlara bölündü):
 *   QUANTIX OS — {PARITE}
 *   Sinyal: {VERDICT}{TEYIT} · Skor {skor}/100
 *   Yön eğilimi: {YÖN} · {fiyat}
 *   {ibare}
 *   {site}
 */

import type { Pair } from "@/lib/constants/pairs";
import type { Direction } from "@/lib/score/orchestrator";
import type { ConfirmStatus } from "@/lib/store/signalConfirmStore";
import { BRAND } from "@/lib/brand";

export interface ShareTextInput {
  pair: Pair;
  direction: Direction;
  verdict: "go" | "wait" | "no";
  confirmStatus: ConfirmStatus | null;
  score: number;
  priceLabel: string;
  labels: {
    verdict: Record<"go" | "wait" | "no", string>;
    direction: Record<Direction, string>;
    confirmPending: string;
    confirmUnknown: string;
    disclaimer: string;
    signalLabel: string;
    scoreLabel: string;
    directionLeaningLabel: string;
    /** NEUTRAL yönde üçüncü satır sadece fiyat gösterir: "{priceOnlyLabel}: {fiyat}". */
    priceOnlyLabel: string;
  };
  siteUrl: string;
}

export function buildShareText(input: ShareTextInput): string {
  const { labels } = input;

  // Teyit ifadesi SADECE verdict "go" iken anlamlı — bu satır ekstra bir
  // "verdict==='go'" kontrolü YAPMIYOR çünkü buna gerek yok: confirmStatus
  // zaten resolveConfirmStatus()'tan geliyor, o fonksiyon verdict "go"
  // değilse her zaman null döner (bkz. lib/store/signalConfirmStore.ts) —
  // yani kural burada değil, tek kaynakta (ShareButton.tsx) yapısal olarak
  // garanti. confirmed → ek metin yok.
  // Parantez — "· " ile üç eşdeğer öğe gibi okunmasın diye (kullanıcı
  // kararı): teyit ifadesinin verdict'e bağlı olduğu parantezle netleşiyor,
  // skorla aynı seviyede ayrı bir öğe gibi görünmüyor.
  const confirmSuffix =
    input.confirmStatus === "pending"
      ? ` (${labels.confirmPending})`
      : input.confirmStatus === "unknown"
      ? ` (${labels.confirmUnknown})`
      : "";

  const thirdLine =
    input.direction === "NEUTRAL"
      ? `${labels.priceOnlyLabel}: ${input.priceLabel}`
      : `${labels.directionLeaningLabel}: ${labels.direction[input.direction]} · ${input.priceLabel}`;

  return [
    `${BRAND.name} ${BRAND.system} — ${input.pair}`,
    `${labels.signalLabel}: ${labels.verdict[input.verdict]}${confirmSuffix} · ${labels.scoreLabel} ${Math.round(input.score)}/100`,
    thirdLine,
    labels.disclaimer,
    input.siteUrl,
  ].join("\n");
}
