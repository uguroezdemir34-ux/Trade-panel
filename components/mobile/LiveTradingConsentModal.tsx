"use client";

/**
 * LIVE TRADING CONSENT MODAL — Adım 3 (Hukuki Koruma ve Kullanıcı Rıza
 * Katmanı) UI'ı.
 *
 * EXECUTION_ENABLED (lib/config/execution.ts) global/build-time bir kill
 * switch — TÜM kullanıcılar için aynı anda açılır/kapanır. Bu modal onun
 * ÜZERİNE binen, KULLANICI BAZLI bir rıza katmanı: EXECUTION_ENABLED true
 * olsa bile, her kullanıcı kendi cihazında bu onayı vermeden gerçek emir
 * gönderemez (bkz. QuickTradeSheet.tsx guard'ları).
 *
 * Double-opt-in: (1) checkbox'ı aktif olarak işaretlemek + (2) ayrı bir
 * "Onaylıyorum ve Aktifleştiriyorum" butonuna tıklamak — iki bağımsız,
 * kasıtlı aksiyon. Tek bir "Kabul Et" butonu (DisclaimerModal'ın deseni)
 * BİLEREK kullanılmadı — para/emir riski taşıyan bu onay, salt bilgilendirme
 * amaçlı genel disclaimer'dan daha katı olmalı.
 *
 * Kayıt — İKİ AYRI mekanizma, kasıtlı olarak:
 *   1. `settingsStore.liveTradingConsentAccepted` (boolean) — UI gate'i,
 *      "live_trading_consent_accepted" localStorage key'i (persist.ts
 *      üzerinden, user-scoped prefix'li).
 *   2. Ham, timestamp'li kanıt kaydı — "qx_consent_v1" key'i, DisclaimerModal
 *      ("qx_disclaimer_v1") ile AYNI desende, düz (prefix'siz) localStorage.
 *      Bu, (1)'den bağımsız olarak KİMİN NE ZAMAN onayladığını kanıtlar —
 *      (1) resetlense/sıfırlansa bile bu kayıt kalır (hukuki iz).
 */

import { useState } from "react";
import { useSettingsStore } from "@/lib/store/settingsStore";

const CONSENT_RECORD_KEY = "qx_consent_v1";

interface ConsentRecord {
  accepted: true;
  timestamp: number;
}

function persistConsentRecord(): void {
  try {
    const record: ConsentRecord = { accepted: true, timestamp: Date.now() };
    localStorage.setItem(CONSENT_RECORD_KEY, JSON.stringify(record));
  } catch {
    // localStorage erişilemiyor — settingsStore'daki boolean yine de set
    // edilir (saveToStorage kendi içinde graceful fail yapıyor), sadece
    // bu ek kanıt kaydı yazılamamış olur.
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Rıza onaylandıktan SONRA çağrılır — caller submit akışına devam edebilir. */
  onAccepted?: () => void;
}

export function LiveTradingConsentModal({
  open,
  onClose,
  onAccepted,
}: Props): React.ReactElement | null {
  const [checked, setChecked] = useState(false);
  const setLiveTradingConsentAccepted = useSettingsStore(
    (s) => s.setLiveTradingConsentAccepted,
  );

  if (!open) return null;

  function handleConfirm(): void {
    if (!checked) return;
    setLiveTradingConsentAccepted(true);
    persistConsentRecord();
    setChecked(false);
    onAccepted?.();
    onClose();
  }

  function handleCancel(): void {
    setChecked(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#111113] p-6 shadow-2xl sm:rounded-2xl">
        {/* Icon + Title */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#EF4444]">
              Canlı İşlem Rızası
            </p>
            <p className="font-mono text-[10px] tracking-widest text-[#6B7280]">
              Devam etmeden önce okuyun
            </p>
          </div>
        </div>

        {/* Body */}
        <p className="font-mono text-sm leading-relaxed text-[#D1D5DB]">
          Bu yazılım kesinlikle bir{" "}
          <strong className="text-white">
            yatırım danışmanlığı veya portföy yönetim hizmeti değildir
          </strong>
          . Algoritmik kararların tüm finansal sorumluluğu kullanıcıya
          aittir. QUANTIX OS, üretilen sinyallere dayanarak açılacak
          işlemlerin kâr veya zararından hiçbir şekilde sorumlu tutulamaz.
        </p>

        {/* Checkbox — opt-in adım 1 */}
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3 transition-colors hover:border-white/20">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#1E40AF]"
          />
          <span className="font-mono text-xs leading-relaxed text-[#D1D5DB]">
            Yukarıdaki uyarıyı okudum, anladım ve algoritmik kararlara
            dayanarak açacağım tüm işlemlerin sorumluluğunun bana ait
            olduğunu kabul ediyorum.
          </span>
        </label>

        {/* Buttons — opt-in adım 2: ayrı, kasıtlı bir tıklama */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 rounded-lg border border-white/10 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[#9CA3AF] transition-colors hover:bg-white/5"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!checked}
            className="flex-1 rounded-lg bg-[#1E40AF] py-3 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-30 active:scale-[0.98]"
          >
            Onaylıyorum ve Aktifleştiriyorum
          </button>
        </div>
      </div>
    </div>
  );
}
