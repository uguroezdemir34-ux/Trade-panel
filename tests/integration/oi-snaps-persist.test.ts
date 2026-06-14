// @vitest-environment jsdom
/**
 * OI SNAPSHOT PERSISTENCE TESTS — Fix 3 (localStorage TTL filter).
 *
 * The private loadOiSnapshots / saveOiSnapshots helpers in macroStore use
 * the same logic replicated here so we can test it directly without
 * exporting internal store functions.
 *
 * Covers:
 *  - Empty localStorage → {}
 *  - Fresh snapshots (< 2h) are preserved
 *  - Stale snapshots (≥ 2h) are filtered out
 *  - Mix of fresh/stale → only fresh kept
 *  - All-stale pair → pair key removed from result
 *  - Invalid JSON → no crash, returns {}
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { OiSnapshot } from "@/lib/market/oi-velocity";
import type { Pair } from "@/lib/constants/pairs";

// Same constants as in macroStore (not exported — replicated for testing)
const OI_SNAPS_KEY = "quantix_oi_snaps_v1";
const OI_SNAP_MAX_AGE_MS = 2 * 60 * 60_000; // 2 hours

function loadOiSnapshots(): Partial<Record<Pair, OiSnapshot[]>> {
  try {
    const raw = localStorage.getItem(OI_SNAPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<Pair, OiSnapshot[]>>;
    const now = Date.now();
    const fresh: Partial<Record<Pair, OiSnapshot[]>> = {};
    for (const [pair, snaps] of Object.entries(parsed)) {
      if (!Array.isArray(snaps)) continue;
      const kept = snaps.filter((s) => now - s.timestamp < OI_SNAP_MAX_AGE_MS);
      if (kept.length > 0) fresh[pair as Pair] = kept;
    }
    return fresh;
  } catch {
    return {};
  }
}

function saveOiSnapshots(snaps: Partial<Record<Pair, OiSnapshot[]>>): void {
  localStorage.setItem(OI_SNAPS_KEY, JSON.stringify(snaps));
}

function makeSnap(ageMs: number, oi = 1000, price = 50000): OiSnapshot {
  return { timestamp: Date.now() - ageMs, openInterest: oi, price };
}

describe("OI Snapshot Persistence — TTL filter (Fix 3)", () => {
  beforeEach(() => localStorage.clear());

  it("empty localStorage → empty object", () => {
    expect(loadOiSnapshots()).toEqual({});
  });

  it("fresh snapshot (30 min old) is kept", () => {
    saveOiSnapshots({ BTC: [makeSnap(30 * 60_000)] } as Partial<Record<Pair, OiSnapshot[]>>);
    const loaded = loadOiSnapshots();
    expect(loaded["BTC" as Pair]).toHaveLength(1);
  });

  it("stale snapshot (3 hours old) is filtered out", () => {
    saveOiSnapshots({ BTC: [makeSnap(3 * 60 * 60_000)] } as Partial<Record<Pair, OiSnapshot[]>>);
    const loaded = loadOiSnapshots();
    expect(loaded["BTC" as Pair]).toBeUndefined();
  });

  it("mix of fresh + stale → only fresh preserved", () => {
    const fresh = makeSnap(30 * 60_000, 1100, 51000);
    const stale = makeSnap(3 * 60 * 60_000, 1000, 50000);
    saveOiSnapshots({ BTC: [stale, fresh] } as Partial<Record<Pair, OiSnapshot[]>>);
    const loaded = loadOiSnapshots();
    expect(loaded["BTC" as Pair]).toHaveLength(1);
    expect(loaded["BTC" as Pair]![0].openInterest).toBe(1100);
  });

  it("all-stale pair → pair key absent from result", () => {
    const stale = makeSnap(3 * 60 * 60_000);
    saveOiSnapshots({
      BTC: [stale],
      ETH: [stale],
    } as Partial<Record<Pair, OiSnapshot[]>>);
    const loaded = loadOiSnapshots();
    expect(Object.keys(loaded)).toHaveLength(0);
  });

  it("multiple pairs: fresh ones kept, stale ones dropped", () => {
    saveOiSnapshots({
      BTC: [makeSnap(10 * 60_000)],          // fresh
      ETH: [makeSnap(3 * 60 * 60_000)],      // stale
      SOL: [makeSnap(90 * 60_000)],           // fresh (1.5h)
    } as Partial<Record<Pair, OiSnapshot[]>>);
    const loaded = loadOiSnapshots();
    expect(loaded["BTC" as Pair]).toHaveLength(1);
    expect(loaded["ETH" as Pair]).toBeUndefined();
    expect(loaded["SOL" as Pair]).toHaveLength(1);
  });

  it("invalid JSON → empty object, no throw", () => {
    localStorage.setItem(OI_SNAPS_KEY, "not-valid-json{{{");
    expect(() => loadOiSnapshots()).not.toThrow();
    expect(loadOiSnapshots()).toEqual({});
  });

  it("non-array value for a pair → skipped", () => {
    // Corrupt entry: pair maps to a non-array
    localStorage.setItem(OI_SNAPS_KEY, JSON.stringify({ BTC: "corrupt" }));
    const loaded = loadOiSnapshots();
    expect(loaded["BTC" as Pair]).toBeUndefined();
  });

  it("save → load round-trip preserves snapshot fields", () => {
    const snap: OiSnapshot = { timestamp: Date.now() - 5000, openInterest: 98765, price: 67890 };
    saveOiSnapshots({ BTC: [snap] } as Partial<Record<Pair, OiSnapshot[]>>);
    const loaded = loadOiSnapshots();
    const retrieved = loaded["BTC" as Pair]![0];
    expect(retrieved.openInterest).toBe(98765);
    expect(retrieved.price).toBe(67890);
  });
});
