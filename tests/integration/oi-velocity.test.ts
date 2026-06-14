/**
 * OI VELOCITY TESTS — Fix 3 root cause + regime logic.
 *
 * Covers:
 *  - 1 snapshot → null (minimum 2 required — was root cause of empty OI card)
 *  - 2+ snapshots → non-null result
 *  - All four OI×Price regimes
 *  - price=0 in snapshot → null guard
 *  - computeOiVelocityWindow window slicing
 */

import { describe, it, expect } from "vitest";
import {
  computeOiVelocity,
  computeOiVelocityWindow,
} from "@/lib/market/oi-velocity";
import type { OiSnapshot } from "@/lib/market/oi-velocity";
import type { Pair } from "@/lib/constants/pairs";

const PAIR: Pair = "BTC";

function snap(ts: number, oi: number, price: number): OiSnapshot {
  return { timestamp: ts, openInterest: oi, price };
}

// ─────────────────────────────────────────────────────────────
// computeOiVelocity
// ─────────────────────────────────────────────────────────────

describe("computeOiVelocity()", () => {
  it("empty array → null", () => {
    expect(computeOiVelocity([], PAIR)).toBeNull();
  });

  it("1 snapshot → null (Fix 3: ≥2 snapshots required for velocity)", () => {
    expect(computeOiVelocity([snap(0, 1000, 50000)], PAIR)).toBeNull();
  });

  it("2 snapshots → non-null result", () => {
    const result = computeOiVelocity(
      [snap(0, 1000, 50000), snap(60_000, 1050, 51000)],
      PAIR,
    );
    expect(result).not.toBeNull();
    expect(result!.periodCount).toBe(2);
  });

  it("price↑ OI↑ → aggressive_long", () => {
    const result = computeOiVelocity(
      [snap(0, 1000, 50000), snap(1, 1100, 52000)],
      PAIR,
    );
    expect(result!.regime).toBe("aggressive_long");
    expect(result!.oiVelocityScore).toBeGreaterThan(0);
  });

  it("price↓ OI↑ → short_squeeze_risk", () => {
    const result = computeOiVelocity(
      [snap(0, 1000, 50000), snap(1, 1100, 47000)],
      PAIR,
    );
    expect(result!.regime).toBe("short_squeeze_risk");
    expect(result!.oiVelocityScore).toBeLessThan(0);
  });

  it("price↑ OI↓ → long_unwind", () => {
    const result = computeOiVelocity(
      [snap(0, 1000, 50000), snap(1, 900, 52000)],
      PAIR,
    );
    expect(result!.regime).toBe("long_unwind");
    expect(result!.oiVelocityScore).toBeLessThan(0);
  });

  it("price↓ OI↓ → bear_exhaustion", () => {
    const result = computeOiVelocity(
      [snap(0, 1000, 50000), snap(1, 900, 47000)],
      PAIR,
    );
    expect(result!.regime).toBe("bear_exhaustion");
    expect(result!.oiVelocityScore).toBeGreaterThan(0);
  });

  it("first snapshot price=0 → null (Fix 2: price guard)", () => {
    expect(
      computeOiVelocity([snap(0, 1000, 0), snap(1, 1100, 51000)], PAIR),
    ).toBeNull();
  });

  it("first snapshot OI=0 → null", () => {
    expect(
      computeOiVelocity([snap(0, 0, 50000), snap(1, 1100, 51000)], PAIR),
    ).toBeNull();
  });

  it("oiVelocityScore clamped to [-10, +10]", () => {
    // Massive OI jump → raw score > 10 before clamp
    const result = computeOiVelocity(
      [snap(0, 100, 50000), snap(1, 100_000, 60000)],
      PAIR,
    );
    expect(result!.oiVelocityScore).toBeLessThanOrEqual(10);
    expect(result!.oiVelocityScore).toBeGreaterThanOrEqual(-10);
  });

  it("tiny changes below threshold → neutral regime", () => {
    // OI +0.1%, price +0.1% — both below minOiPct (0.5) and minPricePct (0.3)
    const result = computeOiVelocity(
      [snap(0, 10000, 50000), snap(1, 10010, 50050)],
      PAIR,
    );
    expect(result!.regime).toBe("neutral");
  });
});

// ─────────────────────────────────────────────────────────────
// computeOiVelocityWindow
// ─────────────────────────────────────────────────────────────

describe("computeOiVelocityWindow()", () => {
  it("1 snapshot → null", () => {
    expect(computeOiVelocityWindow([snap(0, 1000, 50000)], PAIR)).toBeNull();
  });

  it("2 snapshots → non-null", () => {
    expect(
      computeOiVelocityWindow(
        [snap(0, 1000, 50000), snap(1, 1050, 51000)],
        PAIR,
      ),
    ).not.toBeNull();
  });

  it("uses last windowSize snapshots (default 5)", () => {
    const snaps = Array.from({ length: 10 }, (_, i) =>
      snap(i * 60_000, 1000 + i * 10, 50000 + i * 100),
    );
    const result = computeOiVelocityWindow(snaps, PAIR, 5);
    expect(result!.periodCount).toBe(5);
  });

  it("windowSize=3 → uses last 3", () => {
    const snaps = Array.from({ length: 8 }, (_, i) =>
      snap(i * 60_000, 1000 + i * 10, 50000 + i * 100),
    );
    const result = computeOiVelocityWindow(snaps, PAIR, 3);
    expect(result!.periodCount).toBe(3);
  });

  it("window larger than array → uses full array", () => {
    const snaps = [snap(0, 1000, 50000), snap(1, 1050, 51000)];
    const result = computeOiVelocityWindow(snaps, PAIR, 10);
    expect(result!.periodCount).toBe(2);
  });
});
