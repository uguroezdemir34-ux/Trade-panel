/**
 * OI / FUNDING PROXY PARSE TESTS — dual-format fix doğrulama.
 *
 * parseProxyItems, fetchOpenInterest, fetchFundingRate — her üçü de iki
 * proxy formatını doğru tanımalı:
 *   1. { ok: true,  data: [...] }  — parseOkxEnvelope sarmalı (aktif proxy)
 *   2. { code: "0", data: [...] }  — ham OKX formatı (geriye dönük uyum)
 *   3. ok===false veya code!=="0"  → null / fallback
 *
 * fetch bağımlılığı injection ile mock edilir (test her yerde çalışır,
 * real network gerekmez).
 */

import { describe, it, expect } from "vitest";
import { parseProxyItems } from "@/lib/market/parseProxyItems";
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
// parseProxyItems — shared helper
// ─────────────────────────────────────────────────────────────

describe("parseProxyItems() — shared proxy unwrap helper", () => {
  const ITEMS = [{ foo: "bar" }];

  it("format 1: { ok: true, data:[...] } → items döner", () => {
    const result = parseProxyItems({ ok: true, data: ITEMS });
    expect(result).toEqual(ITEMS);
  });

  it("format 2: { code: '0', data:[...] } → items döner", () => {
    const result = parseProxyItems({ code: "0", msg: "", data: ITEMS });
    expect(result).toEqual(ITEMS);
  });

  it("ok===false → null (fallback sinyali)", () => {
    expect(parseProxyItems({ ok: false, err: "NO_KEYS" })).toBeNull();
  });

  it("code!=='0' → null", () => {
    expect(parseProxyItems({ code: "51001", msg: "error", data: ITEMS })).toBeNull();
  });

  it("ok===true + data=[] → null (boş dizi)", () => {
    expect(parseProxyItems({ ok: true, data: [] })).toBeNull();
  });

  it("code==='0' + data=[] → null (boş dizi)", () => {
    expect(parseProxyItems({ code: "0", data: [] })).toBeNull();
  });

  it("ne ok ne code → null", () => {
    expect(parseProxyItems({ something: "else" })).toBeNull();
  });

  it("çift sarmal: { data: { code:'0', data:[...] } } → items döner", () => {
    const result = parseProxyItems({ data: { code: "0", data: ITEMS } });
    expect(result).toEqual(ITEMS);
  });
});

// ─────────────────────────────────────────────────────────────
// fetchOpenInterest
// ─────────────────────────────────────────────────────────────

describe("fetchOpenInterest() — dual-format proxy parse", () => {
  const PAIR = "BTC" as const;
  const OI_DATA = [
    { instId: "BTC-USDT-SWAP", oi: "98765", oiCcy: "1.234", ts: "1718000000000" },
  ];

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

  it("ok===false → fallback (oi=0, oiCcy=0)", async () => {
    const result = await fetchOpenInterest(
      PAIR,
      mockFetch({ ok: false, err: "NO_KEYS" }),
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

describe("fetchFundingRate() — dual-format proxy parse", () => {
  const PAIR = "BTC" as const;
  const FR_DATA = [
    { instId: "BTC-USDT-SWAP", fundingRate: "0.0001234", fundingTime: "1718000000000" },
  ];

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

  it("ok===false → fallback (rate=0)", async () => {
    const result = await fetchFundingRate(PAIR, mockFetch({ ok: false, err: "NO_KEYS" }));
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

  it("pair değeri sonuçta korunur", async () => {
    const result = await fetchFundingRate("ETH" as const, mockFetch({ ok: true, data: FR_DATA }));
    expect(result.pair).toBe("ETH");
  });
});
