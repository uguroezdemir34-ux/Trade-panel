"use client";

/**
 * USE THROTTLED VALUE — reaktif bir değeri trailing-edge throttle eder.
 *
 * intervalMs penceresinde en fazla 1 kez günceller — pencere içinde gelen
 * ara değerler atlanır ama pencere sonunda en son değer her zaman yansıtılır
 * (trailing edge), yani gerçek bir değişiklik intervalMs'den fazla gecikmez.
 *
 * WS tick gibi çok sık değişen store değerlerini pahalı bir useMemo/hesaplama
 * zincirine bağlamadan önce ara katman olarak kullanılır (bkz.
 * useFlowIntelligence.ts — livePrice için, FAZ 2a).
 */

import { useEffect, useRef, useState } from "react";

export function useThrottledValue<T>(value: T, intervalMs: number): T {
  const [throttled, setThrottled] = useState(value);
  const lastUpdateRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;

    if (elapsed >= intervalMs) {
      lastUpdateRef.current = now;
      setThrottled(value);
      return;
    }

    timerRef.current = setTimeout(() => {
      lastUpdateRef.current = Date.now();
      setThrottled(value);
    }, intervalMs - elapsed);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, intervalMs]);

  return throttled;
}
