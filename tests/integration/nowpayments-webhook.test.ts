/**
 * NOWPAYMENTS WEBHOOK — imza doğrulama testi.
 *
 * Not: HMAC-SHA512 + sıralı-JSON-key yöntemi Claude Code tarafından resmi
 * NOWPayments dokümantasyonuna karşı doğrulandı (bkz. route.ts dosya başı
 * notu). Bu test BURADA YAZILAN fonksiyonun kendi içinde tutarlı olduğunu
 * doğruluyor — gerçek bir NOWPayments hesabıyla uçtan uca canlı test değil.
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyNowPaymentsSignature } from "@/app/api/nowpayments/webhook/route";

const SECRET = "test-ipn-secret";

function signBody(body: Record<string, unknown>, secret: string): string {
  const sortedKeys = Object.keys(body).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of sortedKeys) sorted[k] = body[k];
  const sortedJson = JSON.stringify(sorted);
  return crypto.createHmac("sha512", secret).update(sortedJson).digest("hex");
}

describe("verifyNowPaymentsSignature()", () => {
  it("doğru imza kabul edilir", () => {
    const body = { payment_id: "123", payment_status: "finished", order_id: "user_abc" };
    const rawBody = JSON.stringify(body);
    const sig = signBody(body, SECRET);
    expect(verifyNowPaymentsSignature(rawBody, sig, SECRET)).toBe(true);
  });

  it("key sırası farklı olsa bile aynı imza doğrulanır (sıralama normalize ediliyor)", () => {
    const bodyA = { payment_id: "123", payment_status: "finished", order_id: "user_abc" };
    const bodyB = { order_id: "user_abc", payment_status: "finished", payment_id: "123" };
    const sig = signBody(bodyA, SECRET);
    // rawBody key sırası farklı ama içerik aynı — imza yine geçerli olmalı
    expect(verifyNowPaymentsSignature(JSON.stringify(bodyB), sig, SECRET)).toBe(true);
  });

  it("yanlış secret ile imza reddedilir", () => {
    const body = { payment_id: "123", payment_status: "finished" };
    const sig = signBody(body, SECRET);
    expect(verifyNowPaymentsSignature(JSON.stringify(body), sig, "wrong-secret")).toBe(false);
  });

  it("değiştirilmiş body ile imza reddedilir", () => {
    const body = { payment_id: "123", payment_status: "finished" };
    const sig = signBody(body, SECRET);
    const tampered = JSON.stringify({ payment_id: "123", payment_status: "failed" });
    expect(verifyNowPaymentsSignature(tampered, sig, SECRET)).toBe(false);
  });

  it("bozuk JSON body güvenli şekilde false döner (throw etmez)", () => {
    expect(verifyNowPaymentsSignature("{not json", "somesig", SECRET)).toBe(false);
  });

  it("geçersiz hex imza güvenli şekilde false döner", () => {
    const body = { payment_id: "123" };
    expect(verifyNowPaymentsSignature(JSON.stringify(body), "not-hex-!!!", SECRET)).toBe(false);
  });
});
