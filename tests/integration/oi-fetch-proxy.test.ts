/**
 * OI / FUNDING PROXY PARSE TESTS — Fix A doğrulama.
 *
 * fetchOpenInterest ve fetchFundingRate, proxy'nin iki formatını
 * doğru tanımalı:
 *   1. { ok: true,  data: [...] }  — parseOkxEnvelope (aktif proxy)
 *   2. { code: "0", data: [...] }  — ham OKX formatı (geriye dönük uyum)
 *   3. Her ikisi de değilse        → fallback (oi/rate = 0)
 *
 * fetch bağımlılığı injection ile mock edilir (test her yerde çalışır,
 * real network gerekmez).
 */

import { describe, it, expect } from "vitest";
import { fetchOpenInterest } from "@/lib/market/openInterest";
import { fetchFundingRate } from "@/lib/market/fundingRate";

function mockFetch(body: unknown, status = 200): typeof fetch {
  return async () =>
    ({
      ok: status >= 200 && status < 300,
      json: async () => body,
    }) as Response;
}

// ─────────────────────────────────────────────────────────────
// fetchOpenInterest
// ─────────────────────────────────────────────────────────────

describe("fetchOpenInterest() — proxy format (Fix A)", () => {
  const PAIR = "BTC" as const;
  const OI_DATA = [{ instId: "BTC-USDT-SWAP", oi: "98765", oiCcy: "1.234", ts: "1718000000000" }];

  it("format 1: { ok: true, data:[...] } → oi ve oiCcy parse edilir", async () => {
    const result = await fetchOpenInterest(PAIR, mockFetch({ ok: true, data: OI_DATA }));
    expect(result.source).toBe("api");
    expect(result.oi).toBe(98765);
    expect(result.oiCcy).toBeCloseTo(1.234, 3);
    expect(result.ts).toBe(1718000000000);
  });

  it("format 2: { code: '0', data:[...] } → geriye dönük uyum çalışır", async () => {
    const result = await fetchOpenInterest(
      PAIR,
      mockFetch({ code: "0", msg: "", data: OI_DATA }),
    );
    expect(result.source).toBe("api");
    expect(result.oi).toBe(98765);
  });

  it("ok===false + code yok → fallback (oi=0)", async () => {
    const result = await fetchOpenInterest(
      PAIR,
      mockFetch({ ok: false, err: "NO_DATA" }),
    );
    expect(result.source).toBe("fallback");
    expect(result.oi).toBe(0);
    expect(result.oiCcy).toBe(0);
  });

  it("code!=='0' + ok yok → fallback", async () => {
    const result = await fetchOpenInterest(
      PAIR,
      mockFetch({ code: "51001", msg: "some error" }),
    );
    expect(result.source).toBe("fallback");
  });

  it("HTTP 4xx → fallback", async () => {
    const result = await fetchOpenInterest(PAIR, mockFetch({}, 400));
    expect(result.source).toBe("fallback");
  });

  it("ok===true + data=[] → fallback (boş dizi)", async () => {
    const result = await fetchOpenInterest(PAIR, mockFetch({ ok: true, data: [] }));
    expect(result.source).toBe("fallback");
  });

  it("pair değeri sonuçta korunur", async () => {
    const result = await fetchOpenInterest("ETH" as const, mockFetch({ ok: true, data: OI_DATA }));
    expect(result.pair).toBe("ETH");
  });
});

// ─────────────────────────────────────────────────────────────
// fetchFundingRate
// ─────────────────────────────────────────────────────────────

describe("fetchFundingRate() — proxy format (Fix A)", () => {
  const PAIR = "BTC" as const;
  const FR_DATA = [{ instId: "BTC-USDT-SWAP", fundingRate: "0.0001234", fundingTime: "1718000000000" }];

  it("format 1: { ok: true, data:[...] } → fundingRate parse edilir", async () => {
    const result = await fetchFundingRate(PAIR, mockFetch({ ok: true, data: FR_DATA }));
    expect(result.source).toBe("api");
    expect(result.fundingRate).toBeCloseTo(0.0001234, 7);
    expect(result.annualizedPct).toBeCloseTo(0.0001234 * 3 * 365 * 100, 2);
  });

  it("format 2: { code: '0', data:[...] } → geriye dönük uyum çalışır", async () => {
    const result = await fetchFundingRate(
      PAIR,
      mockFetch({ code: "0", msg: "", data: FR_DATA }),
    );
    expect(result.source).toBe("api");
    expect(result.fundingRate).toBeCloseTo(0.0001234, 7);
  });

  it("ok===false + code yok → fallback (rate=0)", async () => {
    const result = await fetchFundingRate(PAIR, mockFetch({ ok: false, err: "NO_DATA" }));
    expect(result.source).toBe("fallback");
    expect(result.fundingRate).toBe(0);
  });

  it("code!=='0' + ok yok → fallback", async () => {
    const result = await fetchFundingRate(PAIR, mockFetch({ code: "50001", msg: "error" }));
    expect(result.source).toBe("fallback");
  });

  it("ok===true + data=[] → fallback", async () => {
    const result = await fetchFundingRate(PAIR, mockFetch({ ok: true, data: [] }));
    expect(result.source).toBe("fallback");
  });
});
