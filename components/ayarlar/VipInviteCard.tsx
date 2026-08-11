"use client";

/**
 * VIP INVITE CARD — Pro kullanıcının VIP Telegram grubu davet linkini gösterir.
 *
 * Veri kaynağı: /api/vip-invite (bkz. o route'un başlık yorumu). Link,
 * Stripe webhook'unda checkout.session.completed/subscription.updated
 * anında üretilip saklanmıştı — burada sadece okunuyor.
 *
 * ReferralCard'ın aksine link yoksa kart TAMAMEN gizlenmiyor — kullanıcı
 * zaten Pro (bu kart SubscriptionGate ile sarılı, sadece pro/enterprise
 * görür), yani "link yok" burada "linkin henüz üretilememiş olması"
 * anlamına gelir (webhook hatası veya TELEGRAM_VIP_COMMUNITY_CHAT_ID henüz
 * kurulmadı) — sessizce hiçbir şey göstermemek yerine görünür bir "hazırlanıyor"
 * durumu gösterilir (CLAUDE.md §0.1: emin değilse sessiz fallback yerine
 * görünür "bilinmiyor/beklemede" durumu).
 */

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";

type FetchState = "loading" | "has_link" | "pending" | "error";

export function VipInviteCard(): React.ReactElement {
  const t = useT();
  const [state, setState] = useState<FetchState>("loading");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vip-invite")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { inviteLink?: string | null }) => {
        if (cancelled) return;
        if (data.inviteLink) {
          setInviteLink(data.inviteLink);
          setState("has_link");
        } else {
          setState("pending");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCopy(): Promise<void> {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API kullanılamıyor — sessizce yok say, kullanıcı elle kopyalayabilir.
    }
  }

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="text-text-t1 text-sm font-medium">{t("settings.vipInvite.title")}</h3>
        <p className="text-text-t3 mt-1 text-xs leading-relaxed">
          {t("settings.vipInvite.description")}
        </p>
      </div>

      {state === "loading" && (
        <p className="text-text-t4 font-mono text-2xs">{t("settings.vipInvite.loading")}</p>
      )}

      {state === "pending" && (
        <p className="text-signal-amber font-mono text-2xs">{t("settings.vipInvite.pending")}</p>
      )}

      {state === "error" && (
        <p className="text-signal-red font-mono text-2xs">{t("settings.vipInvite.error")}</p>
      )}

      {state === "has_link" && inviteLink && (
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
            {copied ? t("settings.vipInvite.copied") : t("settings.vipInvite.copyButton")}
          </button>
        </div>
      )}
    </div>
  );
}
