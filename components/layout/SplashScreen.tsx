"use client";

import { useEffect, useState } from "react";
import { QuantixLogo } from "@/components/brand/QuantixLogo";
import { useT } from "@/lib/i18n/context";

interface Props {
  onDone: () => void;
}

export function SplashScreen({ onDone }: Props): React.ReactElement {
  const t = useT();
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1700);
    const doneTimer = setTimeout(() => onDone(), 2300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0A0A0A]"
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? "opacity 600ms ease-in" : undefined,
        pointerEvents: fading ? "none" : undefined,
      }}
    >
      {/* Logo */}
      <div className="splash-logo">
        <QuantixLogo size="lg" />
      </div>

      {/* Brand name + OS badge */}
      <div className="splash-name mt-6 flex items-center gap-2.5">
        <span className="font-mono text-[28px] font-bold tracking-[0.14em] text-[#F5F5F5]">
          QUANTIX
        </span>
        <span className="rounded bg-[#FF6B1A] px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-white">
          OS
        </span>
      </div>

      {/* Tagline */}
      <p className="splash-tagline mt-2 font-mono text-[11px] tracking-[0.12em] text-[#707070]">
        {t("app.tagline")}
      </p>

      {/* Progress bar */}
      <div className="absolute bottom-16 left-1/2 h-px w-28 -translate-x-1/2 overflow-hidden bg-[#2A2A2A]">
        <div className="splash-bar h-full bg-[#FF6B1A]" />
      </div>
    </div>
  );
}
