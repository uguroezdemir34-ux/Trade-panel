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

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/serverStubs";

export async function POST(req: NextRequest) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "NOWPayments not configured" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { priceUsd } = (await req.json()) as { priceUsd: number };
  if (!priceUsd || typeof priceUsd !== "number" || priceUsd <= 0) {
    return NextResponse.json({ error: "priceUsd required" }, { status: 400 });
  }

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
