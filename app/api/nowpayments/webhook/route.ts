/**
 * NOWPAYMENTS IPN WEBHOOK — /api/nowpayments/webhook
 *
 * DIŞ API SÖZLEŞMESİ — Claude Code tarafından resmi dokümantasyona (NOWPayments
 * Zendesk HelpCenter + Postman API docs) karşı DOĞRULANDI:
 *   1) İmza yöntemi (HMAC-SHA512, tüm body key'leri alfabetik sıralı
 *      JSON.stringify, `x-nowpayments-sig` header'ı) — resmi Node.js
 *      örneğiyle birebir eşleşiyor, DOĞRU.
 *   2) payment_status tam enum listesi: waiting → confirming → confirmed →
 *      sending → finished, artı partially_paid/failed/refunded/expired.
 *      Bu doğrulamada bir HATA bulundu ve düzeltildi: ilk taslak "confirmed"ı
 *      da başarı sayıyordu, ama confirmed sadece blockchain onayı — fonlar
 *      "finished"a kadar merchant cüzdanına ulaşmamış oluyor (bkz.
 *      SUCCESS_STATUSES yorumu).
 *   3) order_id — IPN body'si, invoice oluşturulurken gönderilen order_id'yi
 *      aynen geri veriyor (resmi örnek payload'da doğrulandı) — checkout
 *      route'unun order_id=userId göndermesi ve buradaki body.order_id
 *      okuması DOĞRU.
 * Doğrulanamayan tek şey: bu ortamda gerçek bir NOWPayments hesabıyla uçtan
 * uca canlı test yapılmadı (sadece dokümantasyon karşılaştırması) — ilk
 * gerçek ödemede izlenmesi önerilir.
 *
 * Akış (dış değerlendirmenin önerdiği sıra): imza doğrula → idempotency +
 * DB güncelleme (process_nowpayments_ipn RPC'si, TEK transaction) → SADECE
 * yeni işlenmiş bir event ise Clerk senkronu. Clerk çağrısı DB
 * transaction'ının İÇİNDE değil — yarıda kalırsa (NOWPayments retry eder)
 * DB tarafı zaten idempotent, Clerk senkronu bir sonraki teslimatta güvenle
 * tekrar denenir.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { processNowPaymentsIpn } from "@/lib/db/nowpayments";
import { patchClerkPublicMetadata } from "@/lib/clerk/metadata";

export const runtime = "nodejs";

/**
 * NOWPayments'ın payment_status'u SADECE "finished" → pro'ya geçiş sayılır.
 * Tam enum listesi Claude Code tarafından resmi dokümantasyona (Zendesk +
 * Postman docs) karşı DOĞRULANDI: waiting → confirming → confirmed → sending
 * → finished, artı partially_paid/failed/refunded/expired. İlk taslakta
 * "confirmed" da başarı sayılıyordu — bu YANLIŞTI: confirmed sadece
 * blockchain onayı demek, fonlar "sending"/"finished"a kadar merchant
 * cüzdanına HENÜZ ULAŞMAMIŞ oluyor. confirmed'ı success sayarsak,
 * confirmed→sending arası bir sorun çıkarsa kullanıcı hiç ödeme
 * tamamlanmadan pro kalabilirdi.
 */
const SUCCESS_STATUSES = new Set(["finished"]);
const FAILURE_STATUSES = new Set(["failed", "expired", "refunded"]);

interface NowPaymentsIpnBody {
  payment_id: string | number;
  payment_status: string;
  order_id?: string; // checkout route'unda userId olarak gönderiliyor, NOWPayments aynen geri veriyor (bkz. dosya başı doğrulama notu 3)
  price_amount?: number;
  price_currency?: string;
}

/**
 * NOWPayments'ın gerçek imza yöntemi — resmi Node.js örneğine karşı
 * DOĞRULANDI: body'nin tüm key'leri alfabetik sıralanıp JSON.stringify
 * edilir, IPN secret key ile HMAC-SHA512 hesaplanır, `x-nowpayments-sig`
 * header'ı ile karşılaştırılır.
 */
export function verifyNowPaymentsSignature(rawBody: string, signatureHeader: string, ipnSecret: string): boolean {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const sortedKeys = Object.keys(parsed).sort();
    const sortedObj: Record<string, unknown> = {};
    for (const key of sortedKeys) sortedObj[key] = parsed[key];
    const sortedJson = JSON.stringify(sortedObj);

    const expected = crypto.createHmac("sha512", ipnSecret).update(sortedJson).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signatureHeader, "hex"));
  } catch {
    return false;
  }
}

/** 30 günlük abonelik dönemi — sabit kod, kalibre edilmiş bir değer değil. */
const SUBSCRIPTION_PERIOD_DAYS = 30;

export async function POST(req: NextRequest) {
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!ipnSecret) {
    return NextResponse.json({ error: "NOWPayments not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-nowpayments-sig") ?? "";

  if (!verifyNowPaymentsSignature(rawBody, signature, ipnSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const body = JSON.parse(rawBody) as NowPaymentsIpnBody;
  const userId = body.order_id;
  const paymentId = String(body.payment_id);
  const status = body.payment_status;

  if (!userId) {
    // order_id yoksa hangi kullanıcıya ait olduğunu bilemeyiz — işleyemeyiz,
    // ama NOWPayments'ın retry döngüsüne girmesin diye 200 dönüyoruz (Stripe
    // webhook'undaki "unhandled event type" davranışıyla aynı felsefe).
    console.error("[nowpayments webhook] order_id (userId) eksik, payment:", paymentId);
    return NextResponse.json({ received: true, skipped: "no_order_id" });
  }

  let newPlan: "free" | "pro" | null = null;
  if (SUCCESS_STATUSES.has(status)) newPlan = "pro";
  else if (FAILURE_STATUSES.has(status)) newPlan = "free";
  // Ara durumlar (waiting/confirming/confirmed/sending/partially_paid) —
  // henüz kesin değil, plan değişikliği yapılmıyor ama event yine de
  // kaydediliyor (hata ayıklama/izlenebilirlik için).

  const eventId = `${paymentId}:${status}`;
  const periodEnd = newPlan === "pro"
    ? new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60_000).toISOString()
    : null;

  try {
    const result = await processNowPaymentsIpn({
      eventId,
      paymentId,
      userId,
      status,
      payload: body,
      newPlan, // null = ara durum, RPC subscription tablosuna hiç dokunmaz
      periodEnd,
    });

    // Ara durum (newPlan===null) İSE Clerk'e hiç dokunma — sadece event
    // kaydı için RPC çağrıldı, plan kararı henüz verilmedi.
    if (newPlan !== null && !result.already_processed) {
      await patchClerkPublicMetadata(userId, { plan: newPlan });
    }
  } catch (err) {
    console.error("[nowpayments webhook] işleme hatası:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
