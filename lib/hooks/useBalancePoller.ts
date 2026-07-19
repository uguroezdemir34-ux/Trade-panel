"use client";

/**
 * BALANCE POLLER — USDT bakiyesini periyodik çeker.
 *
 * activeExchange'e göre doğru borsadan çeker:
 *   okx     → OKX /api/v5/account/balance
 *   binance → Binance /fapi/v2/balance
 *   bybit   → Bybit /v5/account/wallet-balance
 *   gateio  → Gate.io /api/v4/futures/usdt/accounts
 *   kucoin  → KuCoin /api/v1/account-overview
 *   mexc    → MEXC /api/v1/private/account/assets
 *   kraken  → Kraken /derivatives/api/v3/accounts
 */

import { useEffect, useRef } from "react";
import { useAccountStore } from "@/lib/store/accountStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { fetchBalanceDetailed } from "@/lib/okx/balance";
import { fetchBinanceBalance } from "@/lib/binance/balance";
import { fetchBybitBalance } from "@/lib/bybit/balance";
import { fetchGateioBalance } from "@/lib/gateio/balance";
import { fetchKucoinBalance } from "@/lib/kucoin/balance";
import { fetchMexcBalance } from "@/lib/mexc/balance";
import { fetchKrakenBalance } from "@/lib/kraken/balance";

const POLL_INTERVAL_MS = 60_000;

export function useBalancePoller(delayMs = 0): void {
  const setBalance = useAccountStore((s) => s.setBalance);
  const setBalanceFetchError = useAccountStore((s) => s.setBalanceFetchError);
  const credsLoaded = useCredentialStore((s) => s._loaded);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function poll(): Promise<void> {
    const { okxProd, okxDemo, bnbFutures, bybitFutures, gateioFutures, kucoinFutures, mexcFutures, krakenFutures } = useCredentialStore.getState();
    const { demoMode, activeExchange } = useSettingsStore.getState();

    let result;
    if (activeExchange === "binance") {
      result = await fetchBinanceBalance(bnbFutures);
    } else if (activeExchange === "bybit") {
      result = await fetchBybitBalance(bybitFutures);
    } else if (activeExchange === "gateio") {
      result = await fetchGateioBalance(gateioFutures);
    } else if (activeExchange === "kucoin") {
      result = await fetchKucoinBalance(kucoinFutures);
    } else if (activeExchange === "mexc") {
      result = await fetchMexcBalance(mexcFutures);
    } else if (activeExchange === "kraken") {
      result = await fetchKrakenBalance(krakenFutures);
    } else {
      const clientCreds = demoMode ? okxDemo : okxProd;
      result = await fetchBalanceDetailed(demoMode, clientCreds);
    }

    if (result.ok) {
      setBalance(result.total, result.free);
    } else {
      setBalanceFetchError(result.err);
    }
  }

  useEffect(() => {
    if (!credsLoaded) return;

    startTimerRef.current = setTimeout(() => {
      void poll();
      timerRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
    }, delayMs);
    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credsLoaded]);
}
