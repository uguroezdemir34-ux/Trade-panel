import { describe, it, expect } from "vitest";
import { checkMacroAlignmentGate, type MacroAlignmentGateInput } from "@/lib/score/blocks";

function input(overrides: Partial<MacroAlignmentGateInput> = {}): MacroAlignmentGateInput {
  return {
    dxyChangePct: 0,
    usdtDChangePct: 0,
    sp500ChangePct: 0,
    nasdaqChangePct: 0,
    dowChangePct: 0,
    ...overrides,
  };
}

describe("checkMacroAlignmentGate()", () => {
  it("hiçbir eşik aşılmadı → adj 0, reason null", () => {
    const r = checkMacroAlignmentGate(input());
    expect(r.adj).toBe(0);
    expect(r.reason).toBeNull();
  });

  it("DXY tek başına sert yükseliş (>= +2.0%) → baraj adj +10", () => {
    const r = checkMacroAlignmentGate(input({ dxyChangePct: 2.1 }));
    expect(r.adj).toBe(10);
    expect(r.reason).toContain("DXY");
  });

  it("DXY sert DÜŞÜŞ (-2.5%) → baraj tetiklenmez (tek yönlü, sadece yükseliş)", () => {
    const r = checkMacroAlignmentGate(input({ dxyChangePct: -2.5 }));
    expect(r.adj).toBe(0);
  });

  it("USDT.D tek başına sert yükseliş (>= +0.3pp) → baraj adj +10", () => {
    const r = checkMacroAlignmentGate(input({ usdtDChangePct: 0.35 }));
    expect(r.adj).toBe(10);
    expect(r.reason).toContain("USDT.D");
  });

  it("USDT.D sert DÜŞÜŞ (-0.5pp) → baraj tetiklenmez (tek yönlü, sadece yükseliş — DXY ile aynı mantık)", () => {
    const r = checkMacroAlignmentGate(input({ usdtDChangePct: -0.5 }));
    expect(r.adj).toBe(0);
  });

  it("DXY ve USDT.D ikisi de sert yükseliş → adj yine sadece +10 (çift saymaz)", () => {
    const r = checkMacroAlignmentGate(input({ dxyChangePct: 2.2, usdtDChangePct: 0.4 }));
    expect(r.adj).toBe(10);
    expect(r.reason).toContain("DXY");
    expect(r.reason).toContain("USDT.D");
  });

  it("eşiğin tam altında (DXY +1.9%) → baraj tetiklenmez", () => {
    const r = checkMacroAlignmentGate(input({ dxyChangePct: 1.9 }));
    expect(r.adj).toBe(0);
  });

  it("eşiğe tam eşit (DXY +2.0%) → baraj tetiklenir (>=)", () => {
    const r = checkMacroAlignmentGate(input({ dxyChangePct: 2.0 }));
    expect(r.adj).toBe(10);
  });

  it("üç ABD endeksi de hizalı yükseliş (> +0.3%) → bonus adj -5", () => {
    const r = checkMacroAlignmentGate(
      input({ sp500ChangePct: 0.5, nasdaqChangePct: 0.6, dowChangePct: 0.4 }),
    );
    expect(r.adj).toBe(-5);
    expect(r.reason).toContain("risk-on");
  });

  it("üç ABD endeksi de hizalı düşüş (< -0.3%) → ceza adj +6", () => {
    const r = checkMacroAlignmentGate(
      input({ sp500ChangePct: -0.5, nasdaqChangePct: -0.6, dowChangePct: -0.4 }),
    );
    expect(r.adj).toBe(6);
    expect(r.reason).toContain("risk-off ceza");
  });

  it("üç endeksten biri ters yönde → hizalanma tetiklenmez", () => {
    const r = checkMacroAlignmentGate(
      input({ sp500ChangePct: 0.5, nasdaqChangePct: 0.6, dowChangePct: -0.1 }),
    );
    expect(r.adj).toBe(0);
  });

  it("hizalanma eşiğinin altında (hepsi +0.2%) → tetiklenmez", () => {
    const r = checkMacroAlignmentGate(
      input({ sp500ChangePct: 0.2, nasdaqChangePct: 0.2, dowChangePct: 0.2 }),
    );
    expect(r.adj).toBe(0);
  });

  it("baraj + hizalanma-negatif aynı anda → additive (10 + 6 = 16)", () => {
    const r = checkMacroAlignmentGate(
      input({
        dxyChangePct: 2.5,
        usdtDChangePct: 0.5,
        sp500ChangePct: -0.5,
        nasdaqChangePct: -0.6,
        dowChangePct: -0.4,
      }),
    );
    expect(r.adj).toBe(16);
  });

  it("çelişkili sinyal: baraj + hizalanma-pozitif aynı anda → net +5 (10 - 5)", () => {
    const r = checkMacroAlignmentGate(
      input({
        dxyChangePct: 2.5,
        usdtDChangePct: 0.5,
        sp500ChangePct: 0.5,
        nasdaqChangePct: 0.6,
        dowChangePct: 0.4,
      }),
    );
    expect(r.adj).toBe(5);
  });

  it("dxyChangePct null → gate tamamen devre dışı (adj 0), diğer koşullar tetiklenmiş olsa bile", () => {
    const r = checkMacroAlignmentGate(
      input({
        dxyChangePct: null,
        sp500ChangePct: 0.5,
        nasdaqChangePct: 0.6,
        dowChangePct: 0.4,
      }),
    );
    expect(r.adj).toBe(0);
    expect(r.reason).toBeNull();
  });

  it("usdtDChangePct null (cold-start senaryosu) → gate devre dışı", () => {
    const r = checkMacroAlignmentGate(input({ usdtDChangePct: null, dxyChangePct: 2.5 }));
    expect(r.adj).toBe(0);
  });

  it("sp500/nasdaq/dow'dan biri null → gate devre dışı", () => {
    const r = checkMacroAlignmentGate(input({ dowChangePct: null }));
    expect(r.adj).toBe(0);
  });
});
