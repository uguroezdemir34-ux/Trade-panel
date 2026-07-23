"use client";

/**
 * USE STAGGERED POLLER — setTimeout+setInterval poller deseni + resume-jitter.
 *
 * lib/hooks/*Poller.ts dosyalarında tekrarlanan (delayMs→setTimeout→ilk
 * çağrı→setInterval) boilerplate'ini merkezi bir hook'a taşır. Şu an sadece
 * usePositionPoller/useBalancePoller (en sık çalışan iki poller) buna
 * geçirildi — chat'teki resume/donma araştırmasından çıktı: proje genelinde
 * `visibilitychange` HİÇ dinlenmiyordu (grep ile doğrulandı), yani sekme uzun
 * süre arka planda kaldıktan sonra öne dönüşte, throttle edilmiş TÜM
 * interval'lar aynı anda "due" hale gelip aynı milisaniyede fetch
 * patlatabiliyordu. Diğer poller'lar (10+ tane) BİLEREK henüz taşınmadı —
 * ayrı, kademeli bir tur (kullanıcı kararı, "en sık çalışanlardan başlayalım").
 *
 * Davranış:
 *   - Mount: delayMs sonra ilk çağrı, sonra intervalMs'te bir tekrar —
 *     eskiden her poller dosyasında elle yazılan davranışla BİREBİR aynı.
 *   - Resume (visibilitychange → visible, VE en az minHiddenMs gizli
 *     kalmışsa): mevcut interval iptal edilir, 0..maxResumeJitterMs arası
 *     rastgele bir gecikmeyle TEK bir "şimdi çalıştır" tetiklenir, interval
 *     o andan itibaren normal cadence'te yeniden başlar. Amaç: resume anında
 *     N poller aynı milisaniyede değil, birbirinden 0-2sn yayılmış şekilde
 *     ateşlensin (lib/ws/backoff.ts'teki applyJitter ile aynı motivasyon,
 *     WS reconnect tarafı için).
 *   - Kısa tab-switch'ler (minHiddenMs altı gizli kalma) TETİKLEMEZ — zaten
 *     güncel veri varken gereksiz ekstra fetch yapılmasın diye.
 */

import { useEffect, useRef } from "react";

export interface StaggeredPollerOptions {
  /** İlk çağrıdan önceki tek seferlik gecikme (mount stagger, mevcut delayMs deseniyle aynı). Default 0. */
  delayMs?: number;
  /** false ise hiç zamanlanmaz — mevcut "credsLoaded olmadan early-return" deseninin yerini alır. Default true. */
  enabled?: boolean;
  /** Resume tetiklemesi için 0..bu değer arası rastgele gecikme (ms). Default 2000. */
  maxResumeJitterMs?: number;
  /** Resume tetiklemesi için minimum gizli kalma süresi (ms) — kısa tab-switch'leri filtreler. Default 15000. */
  minHiddenMs?: number;
}

export function useStaggeredPoller(
  fn: () => void | Promise<void>,
  intervalMs: number,
  options: StaggeredPollerOptions = {},
): void {
  const {
    delayMs = 0,
    enabled = true,
    maxResumeJitterMs = 2000,
    minHiddenMs = 15000,
  } = options;

  // fn her render'da yeniden oluşan bir closure olabilir (caller'lar genelde
  // component body'sinde tanımlıyor) — ref'e alıp her zaman EN SON versiyonu
  // çağırıyoruz, böylece fn'in kendisi effect dependency'si olmak zorunda
  // kalmıyor (stale closure riski de yok, ref her render'da güncelleniyor).
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    function startInterval(): void {
      timerRef.current = setInterval(() => void fnRef.current(), intervalMs);
    }

    // İlk kurulum — mevcut delayMs→çağrı→interval deseniyle birebir aynı.
    startTimerRef.current = setTimeout(() => {
      startTimerRef.current = null;
      void fnRef.current();
      startInterval();
    }, delayMs);

    function handleVisibilityChange(): void {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      // visible — ilk yüklemede de "visibilitychange" tetiklenmez, sadece
      // gerçekten hidden'dan visible'a dönüşte hiddenAtRef dolu olur.
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt === null) return;
      if (Date.now() - hiddenAt < minHiddenMs) return; // kısa tab-switch — atla

      // Mevcut interval'ı iptal et, jitter'lı TEK bir tetikleme + interval'ı
      // sıfırdan başlat (yakın zamanda hem jitter'lı hem interval'ın kendi
      // catch-up'ından gelen çifte fetch olmasın diye).
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const jitter = Math.random() * maxResumeJitterMs;
      resumeTimerRef.current = setTimeout(() => {
        resumeTimerRef.current = null;
        void fnRef.current();
        startInterval();
      }, jitter);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [enabled, intervalMs, delayMs, maxResumeJitterMs, minHiddenMs]);
}
