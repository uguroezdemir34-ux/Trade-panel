"use client";

/**
 * SENTRY REPLAY HOOK — Session Replay entegrasyonunu geç yükler.
 *
 * AppShell'de bir kez mount edilir. AppShell public route'larda
 * (/sign-in, /sign-up vb.) hiç render edilmediği için (bkz.
 * RouteAwareShell.tsx → isPublicRoute), bu hook da o sayfalarda hiç
 * çalışmaz — Replay'in kodu (@sentry/replay + bağımlılıkları) o
 * route'ların bundle'ına hiç girmez, sadece app sayfalarına
 * girildiğinde (dinamik import ile, ayrı bir chunk olarak) indirilir.
 */

import { useEffect } from "react";
import { loadSentryReplay } from "@/instrumentation-client";

export function useSentryReplay(): void {
  useEffect(() => {
    void loadSentryReplay();
  }, []);
}
