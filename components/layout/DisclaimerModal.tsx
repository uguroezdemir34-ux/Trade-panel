"use client";

/**
 * DISCLAIMER MODAL — Apple App Store 4.2.2 uyumu için zorunlu.
 *
 * Trading uygulamaları App Store'da onaylanabilmek için açık bir risk uyarısı
 * göstermek zorundadır. Bu modal ilk açılışta bir kez gösterilir,
 * sonrasında localStorage'a kaydedilir ve bir daha çıkmaz.
 */

import { useEffect, useState } from "react";

const DISMISSED_KEY = "qx_disclaimer_v1";

export function DisclaimerModal(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

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
              Risk Uyarısı
            </p>
            <p className="font-mono text-[10px] tracking-widest text-[#6B7280]">
              Risk Disclosure
            </p>
          </div>
        </div>

        {/* Turkish */}
        <p className="font-mono text-sm text-[#D1D5DB] leading-relaxed">
          Kripto para vadeli işlemleri <strong className="text-white">yüksek risk</strong> içerir.
          Yatırımınızın tamamını kaybedebilirsiniz.{" "}
          <strong className="text-white">Bu uygulama yatırım tavsiyesi vermez.</strong>{" "}
          Yalnızca kaybetmeyi göze aldığınız sermayeyle işlem yapınız.
        </p>

        {/* English */}
        <p className="mt-3 font-mono text-xs text-[#6B7280] leading-relaxed">
          Cryptocurrency futures trading involves substantial risk of loss and is not
          suitable for all investors. You may lose all of your invested capital.
          This application does not provide investment advice.
          Past performance does not guarantee future results.
        </p>

        {/* Links */}
        <p className="mt-3 font-mono text-[10px] text-[#4B5563]">
          Devam ederek{" "}
          <a href="/terms" className="text-[#60A5FA] underline" target="_blank">
            Kullanım Koşulları
          </a>
          {" "}ve{" "}
          <a href="/privacy" className="text-[#60A5FA] underline" target="_blank">
            Gizlilik Politikası
          </a>
          {" "}kabul edilmiş sayılır.
        </p>

        {/* Accept Button */}
        <button
          type="button"
          onClick={handleAccept}
          className="mt-5 w-full rounded-lg bg-[#1E40AF] py-3 font-mono text-sm font-bold tracking-widest text-white uppercase hover:bg-[#1D4ED8] transition-colors active:scale-[0.98]"
        >
          Anladım, Devam Et
        </button>

        <p className="mt-2 text-center font-mono text-[10px] text-[#374151]">
          I understand and accept the risk disclosure
        </p>
      </div>
    </div>
  );
}
