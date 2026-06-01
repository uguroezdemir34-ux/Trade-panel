"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";

const TV_EXAMPLE = JSON.stringify(
  {
    ticker: "{{ticker}}",
    action: "{{strategy.order.action}}",
    close: "{{close}}",
    high: "{{high}}",
    low: "{{low}}",
    volume: "{{volume}}",
    time: "{{time}}",
    message: "{{strategy.order.comment}}",
  },
  null,
  2,
);

export function TvWebhookCard(): React.ReactElement {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://your-domain.vercel.app";

  const webhookUrl = `${origin}/api/webhook/tv`;

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 mb-1 font-mono text-2xs tracking-widest uppercase">
        📡 TradingView Webhook
      </h3>
      <p className="text-text-t4 font-mono text-2xs mb-3 leading-relaxed">
        {t("settings.tvWebhook.description")}
      </p>

      {/* Webhook URL */}
      <div className="mb-3">
        <div className="text-text-t4 font-mono text-2xs mb-1 tracking-wider">{t("settings.tvWebhook.urlLabel")}</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 overflow-hidden rounded border border-border bg-surface-s1 px-2.5 py-1.5">
            <span className="font-mono text-xs text-text-t2 break-all">{webhookUrl}</span>
          </div>
          <button
            onClick={copyUrl}
            className="shrink-0 rounded border border-border px-2.5 py-1.5 font-mono text-2xs text-text-t3 transition-colors hover:text-text-t1"
          >
            {copied ? t("settings.tvWebhook.copied") : t("settings.tvWebhook.copy")}
          </button>
        </div>
      </div>

      {/* Optional secret */}
      <div className="mb-3 rounded border border-border/50 bg-surface-s1/50 p-2.5">
        <div className="text-text-t3 font-mono text-2xs font-semibold mb-1">
          {t("settings.tvWebhook.security")}
        </div>
        <p className="text-text-t4 font-mono text-2xs leading-relaxed">
          {t("settings.tvWebhook.securityDesc")}
        </p>
      </div>

      {/* JSON template */}
      <div>
        <div className="text-text-t4 font-mono text-2xs mb-1 tracking-wider">{t("settings.tvWebhook.template")}</div>
        <pre className="overflow-x-auto rounded border border-border bg-surface-s1 p-2.5 font-mono text-2xs text-text-t3 leading-relaxed">
          {TV_EXAMPLE}
        </pre>
      </div>

      {/* Steps */}
      <div className="mt-3 flex flex-col gap-1.5">
        {([
          t("settings.tvWebhook.step1"),
          t("settings.tvWebhook.step2"),
          t("settings.tvWebhook.step3"),
          t("settings.tvWebhook.step4"),
        ] as string[]).map((step, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-text-t4 font-mono text-2xs shrink-0 mt-0.5">{i + 1}.</span>
            <span className="text-text-t4 font-mono text-2xs leading-relaxed">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
