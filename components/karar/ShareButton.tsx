"use client";

/**
 * SHARE BUTTON — /karar'daki aktif paritenin skor kartını panoya metin +
 * indirilen PNG olarak sunar, mümkünse ek olarak native paylaşım menüsünü
 * de açar. Her verdict'te çalışır (sadece GO değil) — kart bilgilendirici
 * bir çıktı.
 *
 * SIRA — garanti olan önce, best-effort olan sonra:
 *   1. Panoya kopyala (senkron hazır metin, user-gesture bağlamı tazeyken —
 *      navigator.clipboard.writeText() bazı tarayıcılarda bunu istiyor).
 *   2. PNG üret (async).
 *   3. HER DURUMDA indir — koşulsuz, dallanma yok. Bu GARANTİ yol.
 *   4. navigator.canShare({files}) destekliyorsa navigator.share() dene —
 *      bu BEST-EFFORT. Başarısız olursa (AbortError: kullanıcı menüyü
 *      kapattı; NotAllowedError: user-activation düşmüş; başka bir hata)
 *      SESSİZCE yutulur — dosya zaten indi, metin zaten kopyalandı,
 *      kullanıcı hiçbir şey kaybetmedi. Hata toast'ı SADECE 2. adım (PNG
 *      üretimi) başarısız olursa gösterilir.
 *
 * navigator.share'in geçici user-activation istediği (~5sn) biliniyor —
 * pano yazımı ve PNG üretimi beklendikten SONRA çağrıldığı için bu
 * pencere düşmüş olabilir, bu yüzden 4. adım "best-effort" ve sıra
 * BİLİNÇLİ: garanti olan (indirme) önce çalışıp bitiyor, paylaşım
 * menüsü ek bir bonus, temel akışın önkoşulu değil.
 *
 * Gerçek Android cihazda doğrulanmış bulgu HÂLÂ geçerli ve değerli: X'in
 * Android uygulaması navigator.share({files,text}) ile paylaşılan dosyayı
 * düşürüp SADECE metni alıyor — kullanıcı görseli hiç göremiyor. Bu artık
 * "share'i kaldır" gerekçesi değil, "indirme neden koşulsuz" gerekçesi:
 * X gibi dosyayı düşüren bir uygulamaya paylaşılsa bile kullanıcının
 * cihazında PNG zaten var, galeriden elle ekleyebilir.
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

const SITE_URL = "quantixos.com";

/** epoch ms → "20260725-1432" (yerel saat) — dosya adında galeri sıralaması
 *  ve tek bakışta bulunabilirlik için. */
function formatFileTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${date}-${time}`;
}

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
      const shareText = buildShareText({
        pair: shareData.pair,
        direction: shareData.direction,
        verdict: shareData.verdict,
        confirmStatus: shareData.confirmStatus,
        score: shareData.score,
        priceLabel: shareData.priceLabel,
        labels: {
          ...shareData.labels,
          signalLabel: t("share.signalLabel"),
          scoreLabel: t("share.scoreLabel"),
          directionLeaningLabel: t("share.directionLeaningLabel"),
          priceOnlyLabel: t("share.priceOnlyLabel"),
        },
        siteUrl: SITE_URL,
      });

      // 1. ÖNCE panoya kopyala — bkz. dosya başı yorumu (user-gesture bağlamı).
      let clipboardOk = true;
      try {
        await navigator.clipboard.writeText(shareText);
      } catch {
        clipboardOk = false;
      }

      // 2. PNG üret (async) — bu adım başarısız olursa dış catch'e düşer,
      // tek hata toast'ı burası içindir.
      const blob = await exportShareCardPng(shareData);

      // 3. HER DURUMDA indir — koşulsuz, dallanma yok. GARANTİ yol.
      const fileName = `quantix-${pair}-${formatFileTimestamp(shareData.ts)}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      // revoke'u hemen çağırmak bazı tarayıcılarda a.click()'in indirmeyi
      // başlatmasıyla yarışıyor ve indirmeyi iptal edebiliyor — bir sonraki
      // tick'e ertelendi.
      setTimeout(() => URL.revokeObjectURL(url), 0);

      // 4. BEST-EFFORT paylaşım menüsü — bkz. dosya başı yorumu. Hiçbir
      // hata dış catch'e sızmıyor, indirme/kopyalama zaten tamamlandı.
      const file = new File([blob], fileName, { type: "image/png" });
      const canUseShare =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      // Menü GÖRÜNDÜ mü (opened) — tamamlandı mı (completed) değil. Ekranı
      // bir kez kaplamışsa (kullanıcı görüp kapatmış olsa bile, AbortError)
      // ayrı bir toast'a gerek yok. Hiç görünmediyse (canUseShare false,
      // veya NotAllowedError gibi görünmeden başarısız olduysa) kullanıcının
      // GÖRDÜĞÜ tek onay toast olmalı.
      let opened = false;
      if (canUseShare) {
        try {
          await navigator.share({ files: [file], text: shareText });
          opened = true; // tamamlandı — kesinlikle göründü
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            opened = true; // göründü, kullanıcı kapattı
          }
          // NotAllowedError veya başka bir sebep — muhtemelen hiç
          // görünmedi (user-activation düşmüştü), sessizce yutulur.
        }
      }

      if (!opened) {
        toast(clipboardOk ? t("share.toastDownloadedCopied") : t("share.toastDownloaded"));
      }
    } catch (err) {
      console.warn("[ShareButton] PNG üretimi başarısız:", err);
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
