"use client";

/**
 * MASTER PIN MODAL — `lib/store/secure-storage.ts`'in PIN-tabanlı anahtar
 * modelinin UI katmanı.
 *
 * İki durum:
 *   1. `hasPinConfigured() === false` → "Master PIN Oluştur" (PIN + onay).
 *      `unlock(pin)` ilk çağrıda bu PIN'i "doğru PIN" olarak kaydeder.
 *   2. `hasPinConfigured() === true && isUnlocked() === false` → tam ekran
 *      kilit paneli, sadece PIN alanı.
 *
 * `checked === false` iken (ilk client-side okuma tamamlanana kadar) HİÇBİR
 * ŞEY render edilmez — SSR/hydration mismatch'i önler (DisclaimerModal'daki
 * ile aynı desen).
 *
 * Bu component `lib/i18n` yerine hardcoded Türkçe kullanıyor — proje
 * genelinde bazı sayfalar (örn. app/karar/page.tsx) bu deseni zaten
 * kullanıyor (bkz. CLAUDE.md §7); 12 dil dosyasına tek seferde yeni bir
 * bölüm eklemek bu turun kapsamı/riski dışında tutuldu.
 */

import { useEffect, useState } from "react";
import { usePinLockStore } from "@/lib/store/pinLockStore";
import { unlock } from "@/lib/store/secure-storage";
import { useCredentialStore } from "@/lib/store/credentialStore";

const MIN_PIN_LENGTH = 4;

export function MasterPinModal(): React.ReactElement | null {
  const checked = usePinLockStore((s) => s.checked);
  const unlocked = usePinLockStore((s) => s.unlocked);
  const pinConfigured = usePinLockStore((s) => s.pinConfigured);
  const refresh = usePinLockStore((s) => s.refresh);
  const setUnlocked = usePinLockStore((s) => s.setUnlocked);
  const reloadCredentials = useCredentialStore((s) => s.reload);

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!checked || unlocked) return null;

  const isSetup = !pinConfigured;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    if (pin.length < MIN_PIN_LENGTH) {
      setError(`PIN en az ${MIN_PIN_LENGTH} haneli olmalı.`);
      return;
    }
    if (isSetup && pin !== confirmPin) {
      setError("Girdiğiniz PIN'ler eşleşmiyor.");
      return;
    }

    setSubmitting(true);
    const result = await unlock(pin);
    setSubmitting(false);

    if (result.ok) {
      setUnlocked(true);
      setPin("");
      setConfirmPin("");
      // Boot sırasında kilitliyken load() zaten çalışıp _loaded=true olmuştu
      // (hepsi null döndü) — şimdi gerçek anahtar var, veriyi TEKRAR oku.
      void reloadCredentials();
    } else {
      setError("Yanlış PIN. Tekrar deneyin.");
      setPin("");
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-2xl">
        <div className="mb-5 text-center">
          <div className="mb-2 text-3xl">🔒</div>
          <p className="font-mono text-sm font-bold uppercase tracking-widest text-white">
            {isSetup ? "Master PIN Oluştur" : "QUANTIX OS Kilitli"}
          </p>
          <p className="mt-1.5 font-mono text-xs leading-relaxed text-[#6B7280]">
            {isSetup
              ? "Credential'larınızı (OKX/Telegram) korumak için bir PIN belirleyin. Bu PIN hiçbir yere kaydedilmez — unutursanız kayıtlı credential'lar kurtarılamaz."
              : "Lütfen PIN giriniz"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-white placeholder:text-[#4B5563] focus:border-[#1E40AF] focus:outline-none"
          />
          {isSetup && (
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="PIN (tekrar)"
              className="w-full rounded border border-white/10 bg-black/40 px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-white placeholder:text-[#4B5563] focus:border-[#1E40AF] focus:outline-none"
            />
          )}

          {error && (
            <p className="text-center font-mono text-xs text-[#EF4444]">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || pin.length < MIN_PIN_LENGTH}
            className="w-full rounded-lg bg-[#1E40AF] py-3 font-mono text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-40 active:scale-[0.98]"
          >
            {submitting ? "..." : isSetup ? "PIN Oluştur" : "Kilidi Aç"}
          </button>
        </form>
      </div>
    </div>
  );
}
