// @vitest-environment jsdom
/**
 * EQUITY INDEX POLLER — unmount sırasında in-flight poll() regresyon testi.
 *
 * Kapsam: SADECE lib/hooks/useEquityIndexPoller.ts'in unmount-cleanup
 * davranışı. lib/score/*'a dokunulmadı — isUSMarketOpen() sadece bu test
 * dosyası içinde mock'landı (gerçek dosya değişmedi), piyasa saati/hafta
 * sonu bağımlılığını testten çıkarmak için (aksi halde test, çalıştırıldığı
 * güne göre flaky olurdu).
 *
 * Regresyon konusu (bkz. commit 0856408, 30 Tem): self-rescheduling
 * setTimeout zincirinde unmount tam bir poll() fetch'i beklerken olursa,
 * in-flight çağrı tamamlandığında .then(scheduleNext) koşulsuz yeni bir
 * (artık takip edilmeyen) timer kuruyordu — "hayalet poller". Fix,
 * scheduleNext() başına instance-scoped stoppedRef kontrolü ekledi. Bu
 * test o fix'in DAVRANIŞINI (implementasyon detayına değil) doğruluyor:
 * unmount'tan SONRA tamamlanan bir fetch, yeni bir fetch zincirlemiyor.
 *
 * @vitest-environment jsdom pragma'sı gerekli — global vitest.config.ts
 * "node" environment kullanıyor (DOM'a ihtiyaç duymayan saf mantık
 * testleri için), ama renderHook() gerçek bir DOM gerektiriyor. Bu repo'daki
 * ilk renderHook/jsdom tabanlı hook testi.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEquityIndexPoller } from "@/lib/hooks/useEquityIndexPoller";

vi.mock("@/lib/score/macroScore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/score/macroScore")>();
  return {
    ...actual,
    // Hafta sonu/tatil bağımlılığını testten çıkarır — poll() bu testte
    // her zaman fetch'e gider. Gerçek piyasa-saati mantığına dokunmuyoruz,
    // sadece bu dosyanın çağrısını sabitliyoruz.
    isUSMarketOpen: () => ({ open: true, halfDay: false }),
  };
});

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function okResponse(): Response {
  return { ok: true, json: async () => ({ available: true, indices: {} }) } as Response;
}

describe("useEquityIndexPoller — unmount sırasında in-flight poll (ghost-poller regresyonu)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("poll() fetch'i beklerken unmount olursa, geç gelen yanıt yeni bir poll ZAMANLAMAZ", async () => {
    const first = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValueOnce(first.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderHook(() => useEquityIndexPoller(0));

    // delayMs=0 → ilk poll() setTimeout(0) sonrası tetiklenir.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // fetch hâlâ in-flight iken unmount — cleanup stoppedRef'i true yapar.
    unmount();

    // In-flight istek unmount'tan SONRA tamamlanıyor (gerçek dünyada geç
    // gelen bir HTTP yanıtını simüle ediyor).
    first.resolve(okResponse());
    await first.promise;
    // poll()'un .then(scheduleNext) mikro görevinin çalışmasına izin ver.
    await Promise.resolve();
    await Promise.resolve();

    // scheduleNext() unmount sonrası yeni bir setTimeout kurduysa,
    // POLL_INTERVAL_MS (5dk) ilerisinde fetch 2. kez çağrılırdı.
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("(kontrol) unmount OLMAZSA, POLL_INTERVAL_MS sonra fetch normal şekilde 2. kez çağrılır", async () => {
    const first = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useEquityIndexPoller(0));

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    first.resolve(okResponse());
    await first.promise;
    await Promise.resolve();
    await Promise.resolve();

    // stoppedRef guard'ının normal çalışmayı ENGELLEMEDİĞİNİ doğrular —
    // unmount yoksa scheduleNext() yeni bir timer kurmalı.
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
