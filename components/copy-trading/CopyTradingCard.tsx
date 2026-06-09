"use client";

import React from "react";
import { useT } from "@/lib/i18n/context";

const OKX_URL = process.env.NEXT_PUBLIC_OKX_LEAD_URL ?? "";
const BINANCE_URL = process.env.NEXT_PUBLIC_BINANCE_LEAD_URL ?? "";

async function openUrl(url: string): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    }
  } catch {
    /* fall through to window.open */
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

interface ExchangeSectionProps {
  heading: string;
  steps: string[];
  buttonLabel: string;
  url: string;
  notConfiguredLabel: string;
  accentClass: string;
  buttonClass: string;
}

function ExchangeSection({
  heading,
  steps,
  buttonLabel,
  url,
  notConfiguredLabel,
  accentClass,
  buttonClass,
}: ExchangeSectionProps) {
  const configured = url.length > 0;

  return (
    <div className={`rounded-lg border p-4 ${accentClass}`}>
      <h3 className="font-mono text-sm font-semibold mb-3">{heading}</h3>
      <ol className="space-y-1.5 mb-4 list-decimal list-inside">
        {steps.map((step, i) => (
          <li key={i} className="font-mono text-xs text-text-t2 leading-relaxed">
            {step}
          </li>
        ))}
      </ol>
      {configured ? (
        <button
          type="button"
          onClick={() => void openUrl(url)}
          className={`w-full rounded py-2.5 font-mono text-xs font-semibold tracking-wider transition-opacity hover:opacity-80 active:scale-95 ${buttonClass}`}
        >
          {buttonLabel}
        </button>
      ) : (
        <div className="rounded border border-border py-2 text-center font-mono text-2xs text-text-t3">
          {notConfiguredLabel}
        </div>
      )}
    </div>
  );
}

export function CopyTradingCard(): React.ReactElement {
  const t = useT();

  const okxSteps = [
    t("copyTrading.okxStep1"),
    t("copyTrading.okxStep2"),
    t("copyTrading.okxStep3"),
    t("copyTrading.okxStep4"),
  ];

  const binanceSteps = [
    t("copyTrading.binanceStep1"),
    t("copyTrading.binanceStep2"),
    t("copyTrading.binanceStep3"),
    t("copyTrading.binanceStep4"),
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <h2 className="font-mono text-sm font-semibold text-text-t1 mb-1">
          {t("copyTrading.title")}
        </h2>
        <p className="font-mono text-xs text-text-t2 leading-relaxed">
          {t("copyTrading.description")}
        </p>
        <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <p className="font-mono text-2xs text-amber-400 leading-relaxed">
            {t("copyTrading.disclaimer")}
          </p>
        </div>
      </div>

      {/* OKX */}
      <ExchangeSection
        heading={t("copyTrading.okxHeading")}
        steps={okxSteps}
        buttonLabel={t("copyTrading.okxButton")}
        url={OKX_URL}
        notConfiguredLabel={t("copyTrading.notConfigured")}
        accentClass="border-blue-500/30 bg-blue-500/5"
        buttonClass="bg-blue-600 text-white"
      />

      {/* Binance */}
      <ExchangeSection
        heading={t("copyTrading.binanceHeading")}
        steps={binanceSteps}
        buttonLabel={t("copyTrading.binanceButton")}
        url={BINANCE_URL}
        notConfiguredLabel={t("copyTrading.notConfigured")}
        accentClass="border-yellow-500/30 bg-yellow-500/5"
        buttonClass="bg-yellow-500 text-black"
      />
    </div>
  );
}
