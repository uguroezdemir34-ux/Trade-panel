/**
 * POSITION POLLER — OKX açık pozisyonlarını periyodik çeker.
 *
 * - İlk yüklemede hemen çeker
 * - Sonra her 10s'de bir günceller
 * - positionStore'u günceller
 */

"use client";

import { useEffect, useRef } from "react";
import { fetchPositions } from "@/lib/okx/positions";
import { usePositionStore } from "@/lib/store/positionStore";
import { useCredentialStore } from "@/lib/store/credentialStore";

const POLL_INTERVAL_MS = 10_000;

export function usePositionPoller(delayMs = 0): void {
  const setPositions = usePositionStore((s) => s.setPositions);
  const okxProd = useCredentialStore((s) => s.okxProd);
  const credsLoaded = useCredentialStore((s) => s._loaded);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const okxProdRef = useRef(okxProd);
  okxProdRef.current = okxProd;

  async function fetchAll(): Promise<void> {
    const positions = await fetchPositions(okxProdRef.current);
    if (positions !== null) {
      setPositions(positions);
    }
  }

  useEffect(() => {
    if (!credsLoaded) return;

    startTimerRef.current = setTimeout(() => {
      fetchAll();
      timerRef.current = setInterval(fetchAll, POLL_INTERVAL_MS);
    }, delayMs);
    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credsLoaded]);
}
