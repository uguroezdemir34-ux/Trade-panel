"use client";

/**
 * DEVICE PERF SYNC — devicePerfStore'un mode'unu `data-perf` attribute'u
 * olarak document.documentElement'e yazar (ThemeSync.tsx'teki data-theme
 * deseniyle aynı — CSS'in JS state'ini okuyabilmesi için).
 */

import { useEffect } from "react";
import { useDevicePerfStore } from "@/lib/device/devicePerfStore";
import { useFpsMonitor } from "@/lib/device/useFpsMonitor";

export function DevicePerfSync(): null {
  const mode = useDevicePerfStore((s) => s.mode);
  const init = useDevicePerfStore((s) => s.init);
  const reportFps = useDevicePerfStore((s) => s.reportFps);

  useEffect(() => {
    init();
  }, [init]);

  useFpsMonitor(reportFps);

  useEffect(() => {
    document.documentElement.setAttribute("data-perf", mode);
  }, [mode]);

  return null;
}
