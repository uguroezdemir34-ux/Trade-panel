"use client";

/**
 * REFERRAL CARD — kullanıcının kendi davet linkini gösterir.
 *
 * Veri kaynağı: /api/waitlist/status (zaten var, sadece referralCode alanı
 * eklendi — bkz. o dosyanın başlık yorumu). Waitlist kaydı hiç yoksa
 * (ör. hesap admin tarafından doğrudan açıldıysa) referralCode null döner
 * — bu durumda kart HİÇ render edilmez, uydurma/boş bir kod gösterilmez
 * (CLAUDE.md §0.1: "sistem emin değilse boş değer göstermez").
 *
 * Link, NEXT_PUBLIC_APP_URL yerine BİLEREK window.location.origin
 * kullanıyor — bu env var'ın production'da yanlış/localhost kalması bilinen
 * bir risk sınıfı (bkz. lib/config/env.ts:219 uyarısı), origin her zaman
 * kullanıcının o an gerçekten bulunduğu domain'i verir.
 */

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";

type FetchState = "loading" | "has_code" | "no_code";

export function ReferralCard(): React.ReactElement | null {
  const t = useT();
  const [state, setState] = useState<FetchState>("loading");
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/waitlist/status")
      .then((res) => (res.ok ? res.json() : { referralCode: null }))
      .then((data: { referralCode?: string | null }) => {
        if (cancelled) return;
        if (data.referralCode) {
          setReferralCode(data.referralCode);
          setState("has_code");
        } else {
          setState("no_code");
        }
      })
      .catch(() => {
        if (!cancelled) setState("no_code");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state !== "has_code" || !referralCode) return null;

  const inviteLink = `${window.location.origin}/invite/${referralCode}`;

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API kullanılamıyor (ör. izin reddedildi) — sessizce yok say,
      // kullanıcı linki elle seçip kopyalayabilir.
    }
  }

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="text-text-t1 text-sm font-medium">{t("settings.referral.title")}</h3>
        <p className="text-text-t3 mt-1 text-xs leading-relaxed">
          {t("settings.referral.description")}
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-text-t3 font-mono text-2xs tracking-wider block">
          {t("settings.referral.linkLabel")}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={inviteLink}
            onFocus={(e) => e.target.select()}
            className="bg-bg-page border-border rounded border px-2 py-1 font-mono text-xs text-text-t1 w-full focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="border-border hover:bg-bg-page shrink-0 rounded border px-3 py-1 font-mono text-2xs tracking-widest uppercase transition-colors"
          >
            {copied ? t("settings.referral.copied") : t("settings.referral.copyButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
