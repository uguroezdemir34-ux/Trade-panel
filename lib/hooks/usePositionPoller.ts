"use client";

/**
 * POSITION POLLER — Açık pozisyonları periyodik çeker.
 *
 * activeExchange'e göre doğru borsadan çeker:
 *   okx     → OKX /api/v5/account/positions
 *   binance → Binance /fapi/v2/positionRisk
 *   bybit   → Bybit /v5/position/list
 */

import { useEffect, useRef } from "react";
import { fetchPositions } from "@/lib/okx/positions";
import { fetchBinancePositions } from "@/lib/binance/positions";
import { fetchBybitPositions } from "@/lib/bybit/positions";
import { usePositionStore } from "@/lib/store/positionStore";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { useSettingsStore } from "@/lib/store/settingsStore";

const POLL_INTERVAL_MS = 10_000;

export function usePositionPoller(delayMs = 0): void {
  const setPositions = usePositionStore((s) => s.setPositions);
  const credsLoaded = useCredentialStore((s) => s._loaded);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchAll(): Promise<void> {
    const { okxProd, bnbFutures, bybitFutures } = useCredentialStore.getState();
    const exchange = useSettingsStore.getState().activeExchange;

    let positions = null;
    if (exchange === "binance") {
      positions = await fetchBinancePositions(bnbFutures);
    } else if (exchange === "bybit") {
      positions = await fetchBybitPositions(bybitFutures);
    } else {
      positions = await fetchPositions(okxProd);
    }

    if (positions !== null) {
      setPositions(positions);
    }
  }

  useEffect(() => {
    if (!credsLoaded) return;

    startTimerRef.current = setTimeout(() => {
      void fetchAll();
      timerRef.current = setInterval(() => void fetchAll(), POLL_INTERVAL_MS);
    }, delayMs);
    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credsLoaded]);
}
