import { describe, it, expect } from "vitest";
import { decideAdherence, type GoSignalCandidate } from "@/lib/risk/position-adoption";

const CTIME = 1_700_000_000_000;
const WINDOW_MIN = 30;
const MIN_MS = 60_000;

function candidate(direction: "LONG" | "SHORT", signalTs: number): GoSignalCandidate {
  return { direction, signalTs };
}

describe("decideAdherence()", () => {
  it("boş aday dizisi → null, matchedSignalTs null", () => {
    const r = decideAdherence("LONG", [], CTIME, WINDOW_MIN);
    expect(r.type).toBeNull();
    expect(r.matchedSignalTs).toBeNull();
  });

  it("tek aday, aynı yön, pencere içinde → system_with", () => {
    const signalTs = CTIME - 10 * MIN_MS;
    const r = decideAdherence("LONG", [candidate("LONG", signalTs)], CTIME, WINDOW_MIN);
    expect(r.type).toBe("system_with");
    expect(r.matchedSignalTs).toBe(signalTs);
  });

  it("tek aday, ters yön, pencere içinde → system_against", () => {
    const signalTs = CTIME - 10 * MIN_MS;
    const r = decideAdherence("LONG", [candidate("SHORT", signalTs)], CTIME, WINDOW_MIN);
    expect(r.type).toBe("system_against");
    expect(r.matchedSignalTs).toBe(signalTs);
  });

  it("aday pencere dışında (çok eski) → null", () => {
    const signalTs = CTIME - 31 * MIN_MS;
    const r = decideAdherence("LONG", [candidate("LONG", signalTs)], CTIME, WINDOW_MIN);
    expect(r.type).toBeNull();
    expect(r.matchedSignalTs).toBeNull();
  });

  it("aday cTime'dan sonra (henüz olmamış) → null", () => {
    const signalTs = CTIME + 5 * MIN_MS;
    const r = decideAdherence("LONG", [candidate("LONG", signalTs)], CTIME, WINDOW_MIN);
    expect(r.type).toBeNull();
    expect(r.matchedSignalTs).toBeNull();
  });

  it("pencere alt sınırı dahil (signalTs === windowStart) → eşleşir", () => {
    const signalTs = CTIME - WINDOW_MIN * MIN_MS;
    const r = decideAdherence("LONG", [candidate("LONG", signalTs)], CTIME, WINDOW_MIN);
    expect(r.type).toBe("system_with");
  });

  it("pencere üst sınırı dahil (signalTs === cTime) → eşleşir", () => {
    const r = decideAdherence("LONG", [candidate("LONG", CTIME)], CTIME, WINDOW_MIN);
    expect(r.type).toBe("system_with");
  });

  it("birden fazla aday, aynı yön → en yakın zamanlı (en son) seçilir", () => {
    const older = CTIME - 25 * MIN_MS;
    const newer = CTIME - 5 * MIN_MS;
    const r = decideAdherence(
      "LONG",
      [candidate("LONG", older), candidate("LONG", newer)],
      CTIME,
      WINDOW_MIN,
    );
    expect(r.matchedSignalTs).toBe(newer);
  });

  it("kritik: eski aynı-yön + yeni ters-yön → en yeni (ters yön) kazanır, system_against döner", () => {
    const olderSameDir = CTIME - 25 * MIN_MS;
    const newerOppositeDir = CTIME - 2 * MIN_MS;
    const r = decideAdherence(
      "LONG",
      [candidate("LONG", olderSameDir), candidate("SHORT", newerOppositeDir)],
      CTIME,
      WINDOW_MIN,
    );
    expect(r.type).toBe("system_against");
    expect(r.matchedSignalTs).toBe(newerOppositeDir);
  });

  it("adaylar karışık sırada verilse de sonuç değişmez", () => {
    const a = candidate("SHORT", CTIME - 20 * MIN_MS);
    const b = candidate("LONG", CTIME - 3 * MIN_MS);
    const c = candidate("SHORT", CTIME - 28 * MIN_MS);
    const r1 = decideAdherence("LONG", [a, b, c], CTIME, WINDOW_MIN);
    const r2 = decideAdherence("LONG", [c, a, b], CTIME, WINDOW_MIN);
    expect(r1).toEqual(r2);
    expect(r1.type).toBe("system_with");
    expect(r1.matchedSignalTs).toBe(b.signalTs);
  });
});
