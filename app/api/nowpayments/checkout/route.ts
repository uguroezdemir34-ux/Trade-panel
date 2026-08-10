/**
 * NOWPAYMENTS CHECKOUT — /api/nowpayments/checkout
 *
 * DIŞ API SÖZLEŞMESİ — Claude Code tarafından resmi dokümantasyona karşı
 * DOĞRULANDI: endpoint (`/v1/invoice`) ve alan adları (price_amount,
 * price_currency, order_id, ipn_callback_url, success_url, cancel_url,
 * invoice_url) eşleşiyor. `/v1/invoice` (hosted ödeme sayfası, invoice_url
 * döner) bilerek seçildi — `/v1/payment` (kendi ödeme arayüzünü kurman
 * gerekir) değil, Stripe Checkout'un yönlendirme deneyimine en yakın olan bu.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/serverStubs";
import { getUserReferral } from "@/lib/db/userReferrals";

// Tek kaynak — önceden client'ın gönderdiği priceUsd doğrudan
// güveniliyordu (herhangi biri priceUsd: 0.01 gönderebilirdi, gerçek bir
// güvenlik açığıydı). Referral indirimi eklenirken bu da düzeltildi:
// fiyat artık SADECE burada, sunucu tarafında belirleniyor. app/upgrade/
// _inner.tsx'teki PRO_PRICE_USD (görüntüleme amaçlı) ile elle senkron
// tutulmalı — aynı dosyanın kendi yorumunda zaten belgelenmiş bir kısıt.
const PRO_PRICE_USD = 9.99;
const REFERRAL_DISCOUNT_RATE = 0.2;

/**
 * İndirim, client'tan gönderilen bir koddan DEĞİL, bu kullanıcının kendi
 * user_referrals.referred_by alanından (kayıt olurken zaten sabitlenmiş,
 * bkz. lib/db/userReferrals.ts) belirlenir — aksi halde herkes
 * başkasının herkese açık kodunu girip indirim alabilirdi, gerçekten o
 * kişinin davetiyle gelmiş olmasa bile.
 */
async function resolvePriceUsd(userId: string): Promise<number> {
  const referral = await getUserReferral(userId);
  if (referral?.referred_by) {
    return Math.round(PRO_PRICE_USD * (1 - REFERRAL_DISCOUNT_RATE) * 100) / 100;
  }
  return PRO_PRICE_USD;
}

/**
 * GET — /upgrade sayfasının, ödemeyi başlatmadan ÖNCE doğru (indirimli
 * olabilecek) fiyatı gösterebilmesi için. POST'taki (checkout başlatma)
 * fiyat mantığıyla aynı fonksiyonu paylaşır — sayfada gösterilen tutar ile
 * NOWPayments'ın hosted ödeme sayfasında görünen tutar hiç uyuşmazlık
 * yaşamasın diye.
 */
export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const priceUsd = await resolvePriceUsd(userId);
  return NextResponse.json({ priceUsd, discounted: priceUsd < PRO_PRICE_USD });
}

export async function POST() {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "NOWPayments not configured" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const priceUsd = await resolvePriceUsd(userId);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const npRes = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: priceUsd,
      price_currency: "usd",
      order_id: userId, // webhook route bunu order_id → userId eşleşmesi için okuyor
      order_description: "QUANTIX OS Pro — aylık abonelik",
      ipn_callback_url: `${origin}/api/nowpayments/webhook`,
      success_url: `${origin}/upgrade?success=true`,
      cancel_url: `${origin}/upgrade?canceled=true`,
    }),
  });

  const data = (await npRes.json()) as { invoice_url?: string; message?: string };

  if (!npRes.ok || !data.invoice_url) {
    console.error("NOWPayments invoice error:", data.message);
    return NextResponse.json({ error: data.message ?? "Checkout failed" }, { status: 500 });
  }

  return NextResponse.json({ url: data.invoice_url });
}
