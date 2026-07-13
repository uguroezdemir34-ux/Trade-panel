"use client";

import { useEffect, useRef } from "react";

const SAMPLE_WINDOW_MS = 1000;

/**
 * FPS MONITOR — 1 saniyelik pencerede frame sayısını ölçer.
 *
 * rAF döngüsü SADECE bir kapanış (closure) sayacını artırır — state update
 * YOK, re-render tetiklemez. Pencere dolduğunda (~1sn) TEK BİR callback
 * çağrılır. TickerTape.tsx'in rAF'tan kaçınma gerekçesiyle (CLAUDE.md §9,
 * ana thread rekabeti) çelişmiyor — oradaki risk rAF'ın HER frame'de DOM/
 * state işi yapması; burada döngünün kendisi hiçbir DOM/state işi yapmıyor,
 * sadece ölçüm — ana thread'e ek yük saniyede 1 fonksiyon çağrısından
 * ibaret.
 */
export function useFpsMonitor(onSample: (fps: number) => void): void {
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;

  useEffect(() => {
    let frameCount = 0;
    let windowStart = performance.now();
    let rafId = 0;

    function tick(now: number): void {
      frameCount += 1;
      const elapsed = now - windowStart;
      if (elapsed >= SAMPLE_WINDOW_MS) {
        onSampleRef.current((frameCount * 1000) / elapsed);
        frameCount = 0;
        windowStart = now;
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);
}
