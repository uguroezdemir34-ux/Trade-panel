"use client";

/**
 * SHARE BUTTON — /karar'daki aktif paritenin skor kartını görsel olarak
 * paylaşır. Her verdict'te çalışır (sadece GO değil) — kart bilgilendirici
 * bir çıktı.
 *
 * Akış:
 *   1. renderShareCard()'ı offscreen bir <canvas>'a çiz (lib/share/
 *      exportShareCard.ts) — DOM node/foreignObject YOK (bkz. o dosyanın
 *      başındaki taint bulgusu), PNG Blob üret.
 *   2. Metni HER DURUMDA panoya kopyala — navigator.share text alanını
 *      hedef uygulamaya (X, Telegram) taşımayabiliyor (doğrulandı, bkz.
 *      commit mesajındaki kaynaklar). Kullanıcı hedefte yapıştırır.
 *   3. navigator.share({files, text, title}) varsa dene. Yoksa (masaüstü,
 *      eski tarayıcı) PNG'yi indirme linkiyle sun.
 *
 * shareData TEK yerde (useMemo) hesaplanıyor — hem canvas'a çizilen kart
 * hem panoya kopyalanan metin AYNI objeden okuyor.
 */

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useT, useLocale } from "@/lib/i18n/context";
import type { Pair } from "@/lib/constants/pairs";
import type { ScoreResult } from "@/lib/score/orchestrator";
import { useSignalConfirmStore, resolveConfirmStatus } from "@/lib/store/signalConfirmStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { formatTickPrice } from "@/lib/i18n/format";
import type { ShareCardData } from "@/lib/share/renderShareCard";
import { exportShareCardPng } from "@/lib/share/exportShareCard";
import { buildShareText } from "@/lib/share/shareCardText";

const SITE_URL = "https://quantixos.com";

export function ShareButton({
  pair,
  result,
  price,
}: {
  pair: Pair;
  result: ScoreResult;
  price: number | null;
}): React.ReactElement {
  const t = useT();
  const locale = useLocale();
  const demoMode = useSettingsStore((s) => s.demoMode);
  const confirmEntry = useSignalConfirmStore((s) => s.entries[pair]);
  const [busy, setBusy] = useState(false);

  const shareData = useMemo<ShareCardData>(() => {
    const now = Date.now();
    return {
      pair,
      direction: result.direction,
      verdict: result.verdict,
      confirmStatus: resolveConfirmStatus(result.verdict, !demoMode, confirmEntry, now),
      score: result.score,
      sub: result.sub,
      priceLabel: price != null && price > 0 ? formatTickPrice(price, locale) : "—",
      ts: now,
      locale,
      labels: {
        verdict: { go: t("verdict.go"), wait: t("verdict.wait"), no: t("verdict.no") },
        direction: {
          LONG: t("direction.long"),
          SHORT: t("direction.short"),
          NEUTRAL: t("direction.neutral"),
        },
        confirmPending: t("verdict.confirmPending"),
        confirmUnknown: t("verdict.confirmUnknown"),
        disclaimer: t("share.disclaimer"),
        scoreWeightedNote: t("share.scoreWeightedNote"),
        categoriesRawLabel: t("share.categoriesRawLabel"),
        categories: {
          trend: t("score.categories.trend"),
          adx: t("score.categories.adx"),
          rsi: t("score.categories.rsi"),
          vol: t("score.categories.vol"),
          bb: t("score.categories.bb"),
          vwap: t("score.categories.vwap"),
          funding: t("score.categories.funding"),
          macro: t("score.categories.macro"),
        },
      },
    };
  }, [pair, result, price, locale, demoMode, confirmEntry, t]);

  const handleShare = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await exportShareCardPng(shareData);
      const shareText = buildShareText({
        pair: shareData.pair,
        direction: shareData.direction,
        verdict: shareData.verdict,
        confirmStatus: shareData.confirmStatus,
        score: shareData.score,
        priceLabel: shareData.priceLabel,
        labels: shareData.labels,
        siteUrl: SITE_URL,
      });

      // HER DURUMDA panoya kopyala — bkz. dosya başı yorumu.
      let clipboardOk = true;
      try {
        await navigator.clipboard.writeText(shareText);
      } catch {
        clipboardOk = false;
      }

      const file = new File([blob], `quantix-${pair.toLowerCase()}-${shareData.ts}.png`, {
        type: "image/png",
      });

      const canUseShare =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canUseShare) {
        try {
          await navigator.share({ files: [file], text: shareText, title: "QUANTIX" });
          toast(clipboardOk ? t("share.toastSharedCopied") : t("share.toastShared"));
        } catch (err) {
          // Kullanıcı paylaşım menüsünü iptal ettiyse (AbortError) sessiz kal.
          if (err instanceof Error && err.name === "AbortError") return;
          toast.error(t("share.toastError"));
        }
      } else {
        // navigator.share yok (masaüstü vb.) — indirme linkiyle sun.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        toast(clipboardOk ? t("share.toastDownloadedCopied") : t("share.toastDownloaded"));
      }
    } catch (err) {
      console.warn("[ShareButton] paylaşım başarısız:", err);
      toast.error(t("share.toastError"));
    } finally {
      setBusy(false);
    }
  }, [busy, pair, shareData, t]);

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-2.5 py-1.5 font-mono text-xs text-text-t2 transition-colors hover:text-text-t1 disabled:opacity-50"
      title={t("share.button")}
    >
      <span>⤴</span>
      <span>{busy ? t("share.busy") : t("share.button")}</span>
    </button>
  );
}
