/**
 * SCORE ENGINE IDLE SCHEDULING — runWithIdleBudget() karar mantığı testi.
 *
 * Kapsam: SADECE lib/hooks/useScoreEngine.ts'in zamanlama/yield stratejisi.
 * lib/score/* dosyalarına dokunulmadı, skor hesaplama mantığı test kapsamı
 * DIŞINDA.
 *
 * Ne test EDİLMİYOR: requestIdleCallback'in gerçek tarayıcı zamanlaması
 * (bu ortamda mevcut değil, environment: "node"). Bunun yerine
 * runWithIdleBudget()'ın requestIdleSlotFn enjeksiyon noktası vi.fn() ile
 * mock'lanıp SADECE karar dalının —
 * `deadline === null || deadline.didTimeout || deadline.timeRemaining() <= MIN_REMAINING_MS`
 * — doğru tetiklendiği doğrulanıyor: mock kaç kez çağrıldı, hangi sırada.
 *
 * 3 senaryo kullanıcı tarafından birebir istendi:
 *   1. Sabit yüksek timeRemaining() (20ms), didTimeout: false → 9 pair
 *      boyunca yalnızca İLK slot istenmeli (mock 1 kez çağrılmalı) — ilk
 *      öğe her zaman deadline===null nedeniyle bir slot ister, sonraki 8
 *      öğe 20>3 olduğu için hiç yeni slot istemez.
 *   2. Sabit düşük timeRemaining() (1ms), didTimeout: false → her pair'den
 *      sonra 1<=3 olduğu için yeni slot istenir (mock 9 kez çağrılmalı).
 *   3. didTimeout: true (timeRemaining() değeri ne olursa olsun, örn. 20) →
 *      OR kısa devresi didTimeout'u timeRemaining'den ÖNCE kontrol ettiği
 *      için her pair'den sonra zorla yeni slot istenir (mock 9 kez).
 *
 * Ayrıca: ilk öğenin HİÇBİR koşul kontrolü olmadan (deadline henüz yok)
 * çalıştığını — yani work() çağrısının HER ZAMAN ilk requestIdleSlotFn
 * çağrısından ÖNCE geldiğini — doğrulayan bir sıralama testi de var (bu,
 * önceki turda flaglenen "ilk pair, işe başlamadan önce bir idle slot
 * bekliyor" regresyonunun düzeltildiğini kanıtlar).
 */

import { describe, it, expect, vi } from "vitest";
import { runWithIdleBudget } from "@/lib/hooks/useScoreEngine";

const NINE_ITEMS = Array.from({ length: 9 }, (_, i) => i);

function idleDeadline(timeRemaining: number, didTimeout: boolean) {
  return { didTimeout, timeRemaining: () => timeRemaining };
}

describe("runWithIdleBudget — idle-slot karar mantığı", () => {
  it("sabit yüksek timeRemaining() (20ms), didTimeout:false → 9 pair boyunca sadece 1 slot istenir", async () => {
    const requestIdleSlotFn = vi.fn(async () => idleDeadline(20, false));
    const work = vi.fn();

    const { yieldCount } = await runWithIdleBudget(NINE_ITEMS, work, { requestIdleSlotFn });

    expect(requestIdleSlotFn).toHaveBeenCalledTimes(1);
    expect(yieldCount).toBe(1);
    expect(work).toHaveBeenCalledTimes(9);
  });

  it("sabit düşük timeRemaining() (1ms), didTimeout:false → her pair'de yeni slot istenir (9 kez)", async () => {
    const requestIdleSlotFn = vi.fn(async () => idleDeadline(1, false));
    const work = vi.fn();

    const { yieldCount } = await runWithIdleBudget(NINE_ITEMS, work, { requestIdleSlotFn });

    expect(requestIdleSlotFn).toHaveBeenCalledTimes(9);
    expect(yieldCount).toBe(9);
    expect(work).toHaveBeenCalledTimes(9);
  });

  it("didTimeout:true → timeRemaining() yüksek olsa bile (20ms) her pair'de yeni slot istenir", async () => {
    // timeRemaining() kasıtlı olarak yüksek (20) — bunun tek başına yeterli
    // OLMADIĞINI, zorlayanın didTimeout OR-dalı olduğunu kanıtlamak için.
    const requestIdleSlotFn = vi.fn(async () => idleDeadline(20, true));
    const work = vi.fn();

    const { yieldCount } = await runWithIdleBudget(NINE_ITEMS, work, { requestIdleSlotFn });

    expect(requestIdleSlotFn).toHaveBeenCalledTimes(9);
    expect(yieldCount).toBe(9);
  });

  it("ilk öğe HİÇBİR idle slot beklemeden çalışır — work() ilk requestIdleSlotFn çağrısından önce gelir", async () => {
    const callOrder: string[] = [];
    const requestIdleSlotFn = vi.fn(async () => {
      callOrder.push("slot");
      return idleDeadline(20, false);
    });
    const work = vi.fn((item: number) => {
      callOrder.push(`work:${item}`);
    });

    await runWithIdleBudget(NINE_ITEMS, work, { requestIdleSlotFn });

    // work(0) her zaman ilk "slot" isteğinden ÖNCE gelmeli — deadline===null
    // dalı slot isteğini işTEN SONRA tetikliyor, döngü başlamadan önce değil.
    expect(callOrder[0]).toBe("work:0");
    expect(callOrder[1]).toBe("slot");
  });

  it("isCancelled true olduğunda kalan öğeler işlenmeden döngü durur", async () => {
    const requestIdleSlotFn = vi.fn(async () => idleDeadline(20, false));
    const work = vi.fn();
    let cancelled = false;

    const promise = runWithIdleBudget(NINE_ITEMS, (item) => {
      work(item);
      if (item === 2) cancelled = true; // 3. öğeden sonra iptal
    }, { requestIdleSlotFn, isCancelled: () => cancelled });

    await promise;

    // item 0,1,2 işlenir; sıradaki iterasyon başında isCancelled() true
    // döndüğü için break — 3'ten fazla çağrı olmamalı.
    expect(work).toHaveBeenCalledTimes(3);
  });
});
