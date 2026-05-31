/**
 * BALANCE POLLER — OKX USDT bakiyesini periyodik çeker.
 *
 * - İlk yüklemede hemen çeker
 * - Sonra her 60s'de günceller
 * - accountStore.setBalance() yazar
 */

"use client";

import { useEffect, useRef } from "react";
import { useAccountStore } from "@/lib/store/accountStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { fetchBalance } from "@/lib/okx/balance";

const POLL_INTERVAL_MS = 60_000;

export function useBalancePoller(): void {
  const setBalance = useAccountStore((s) => s.setBalance);
  const setBalanceFetchError = useAccountStore((s) => s.setBalanceFetchError);
  const demoMode = useSettingsStore((s) => s.demoMode);
  const okxProd = useCredentialStore((s) => s.okxProd);
  const okxDemo = useCredentialStore((s) => s.okxDemo);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function poll(): Promise<void> {
    const clientCreds = demoMode ? okxDemo : okxProd;
    const result = await fetchBalance(demoMode, clientCreds);
    if (result) {
      setBalance(result.total, result.free);
    } else {
      setBalanceFetchError();
    }
  }

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [demoMode, okxProd, okxDemo]);
}
