"use client";

/**
 * DISCLAIMER MODAL — Apple App Store 4.2.2 uyumu için zorunlu.
 *
 * Trading uygulamaları App Store'da onaylanabilmek için açık bir risk uyarısı
 * göstermek zorundadır. Bu modal ilk açılışta bir kez gösterilir,
 * sonrasında localStorage'a kaydedilir ve bir daha çıkmaz.
 */

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";

const DISMISSED_KEY = "qx_disclaimer_v1";

export function DisclaimerModal(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);
  const t = useT();

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISSED_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage erişimi yoksa gösterme
    }
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-[#111113] border border-white/10 p-6 shadow-2xl">

        {/* Icon + Title */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-[#EF4444] uppercase font-bold">
              {t("disclaimer.title")}
            </p>
            <p className="font-mono text-[10px] tracking-widest text-[#6B7280]">
              {t("disclaimer.subtitle")}
            </p>
          </div>
        </div>

        {/* Body — single locale, bold preserved via split keys */}
        <p className="font-mono text-sm text-[#D1D5DB] leading-relaxed">
          {t("disclaimer.bodyPre")}{" "}
          <strong className="text-white">{t("disclaimer.bodyBold1")}</strong>
          {" "}{t("disclaimer.bodyMid")}{" "}
          <strong className="text-white">{t("disclaimer.bodyBold2")}</strong>
          {" "}{t("disclaimer.bodyPost")}
        </p>

        {/* Links */}
        <p className="mt-3 font-mono text-[10px] text-[#4B5563]">
          {t("disclaimer.legalPrefix")}{" "}
          <a href="/terms" className="text-[#60A5FA] underline" target="_blank">
            {t("disclaimer.terms")}
          </a>
          {" "}{t("disclaimer.and")}{" "}
          <a href="/privacy" className="text-[#60A5FA] underline" target="_blank">
            {t("disclaimer.privacy")}
          </a>
          {t("disclaimer.legalSuffix")}
        </p>

        {/* Accept Button */}
        <button
          type="button"
          onClick={handleAccept}
          className="mt-5 w-full rounded-lg bg-[#1E40AF] py-3 font-mono text-sm font-bold tracking-widest text-white uppercase hover:bg-[#1D4ED8] transition-colors active:scale-[0.98]"
        >
          {t("disclaimer.acceptBtn")}
        </button>

        <p className="mt-2 text-center font-mono text-[10px] text-[#374151]">
          {t("disclaimer.acceptSub")}
        </p>
      </div>
    </div>
  );
}
