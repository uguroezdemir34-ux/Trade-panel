/**
 * SHARE TEXT — görselle birlikte panoya kopyalanan / navigator.share'e
 * geçilen metin. Kartta olup metinde olmayan bir bilgi (özellikle teyit
 * durumu), metin tek başına paylaşıldığında aynı bilgi asimetrisini
 * yaratır — bu yüzden kartla BİREBİR aynı alanları taşır (kullanıcı kararı).
 */

import type { Pair } from "@/lib/constants/pairs";
import type { Direction } from "@/lib/score/orchestrator";
import type { ConfirmStatus } from "@/lib/store/signalConfirmStore";

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
  };
  siteUrl: string;
}

export function buildShareText(input: ShareTextInput): string {
  const { labels } = input;
  const verdictLine = [
    labels.verdict[input.verdict],
    input.confirmStatus === "pending" ? labels.confirmPending : null,
    input.confirmStatus === "unknown" ? labels.confirmUnknown : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    `QUANTIX — ${input.pair} ${labels.direction[input.direction]}`,
    `${verdictLine} — ${Math.round(input.score)}/100`,
    input.priceLabel,
    labels.disclaimer,
    input.siteUrl,
  ].join("\n");
}
