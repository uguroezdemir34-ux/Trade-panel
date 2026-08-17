"use client";

/**
 * AI ANALİZ BUTONU — /karar ve /grafik'te ortak. Skor motorunun o an
 * önerdiği yön için app/api/signal/analyze/route.ts'i tetikleyen
 * AiAnalizModal'ı açar. Yön NEUTRAL/yönsüzse buton pasif (kullanıcı
 * talimatı — bkz. AiAnalizModal.tsx dosya başı yorumu).
 */

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import type { Pair } from "@/lib/constants/pairs";
import { AiAnalizModal } from "./AiAnalizModal";

export function AiAnalizButton({
  pair,
  direction,
  score,
}: {
  pair: Pair;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  score: number;
}): React.ReactElement {
  const t = useT();
  const [open, setOpen] = useState(false);
  const disabled = direction === "NEUTRAL";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-2.5 py-1.5 font-mono text-xs text-text-t2 transition-colors hover:text-text-t1 disabled:opacity-40 disabled:cursor-not-allowed"
        title={disabled ? t("karar.aiAnalizButtonDisabledTitle") : t("karar.aiAnalizButtonTitle")}
      >
        <span>🤖</span>
        <span>{t("karar.aiAnalizButton")}</span>
      </button>

      {open && !disabled && (
        <AiAnalizModal
          pair={pair}
          direction={direction}
          score={score}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
