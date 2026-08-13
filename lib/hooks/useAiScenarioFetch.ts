"use client";

/**
 * AI SENARYO — paylaşılan fetch/state-machine hook'u.
 *
 * components/grafik/AiScenarioTab.tsx'teki (kaldırılan) state machine'in
 * BİREBİR aynısı — davranış değişmedi, sadece konumu değişti (refactor).
 *
 * `url` null ise hiç fetch etmez — "desteklenmiyor" gibi üçüncü bir durum
 * bu hook'un işi DEĞİL, çağıranın sorumluluğu (AiScenarioTab kendi
 * isSupported() kontrolünü hâlâ kendi tarafında yapıyor, hook'a hiç
 * sormuyor; url=null geçtiğinde effect hiçbir şey yapmadan çıkar, state
 * başlangıç değerinde — "loading" — kalır ama çağıran bunu hiç render
 * etmiyor, bu yüzden kullanıcı hiçbir zaman takılı bir spinner görmüyor).
 */

import { useEffect, useState } from "react";
import type { AiScenarioRow } from "@/app/api/ai-scenario/route";

export type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready"; row: AiScenarioRow };

export function useAiScenarioFetch(url: string | null): FetchState {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setState({ status: "loading" });

    async function run(): Promise<void> {
      try {
        const res = await fetch(url as string, { signal: AbortSignal.timeout(8_000) });
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }
        const json = (await res.json()) as { ok: boolean; data: AiScenarioRow | null };
        if (cancelled) return;
        if (!json.ok || !json.data) {
          setState({ status: "empty" });
          return;
        }
        setState({ status: "ready", row: json.data });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
