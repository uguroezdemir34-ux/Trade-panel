import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/auth/serverStubs";

/**
 * STRIPE CUSTOMER PORTAL — self-servis fatura/abonelik yönetimi.
 *
 * stripeCustomerId, webhook'un checkout.session.completed'de Clerk
 * publicMetadata'ya yazdığı değer (bkz. app/api/stripe/webhook/route.ts).
 * O event hiç gelmemişse (örn. abonelik Dashboard'dan elle açıldıysa)
 * kullanıcının stripeCustomerId'si olmaz — bu durumda 404 döner, UI
 * tarafı bunu "Faturamı Yönet" yerine "/upgrade"'e yönlendirerek ele alır.
 */
export async function POST(_req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const customerId = user?.publicMetadata?.stripeCustomerId;
  if (typeof customerId !== "string" || !customerId) {
    return NextResponse.json({ error: "No billing account found for this user" }, { status: 404 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const params = new URLSearchParams({
    customer: customerId,
    return_url: `${origin}/ayarlar`,
  });

  const stripeRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${stripeKey}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = (await stripeRes.json()) as { url?: string; error?: { message: string } };

  if (!stripeRes.ok || !data.url) {
    console.error("Stripe portal error:", data.error);
    return NextResponse.json({ error: data.error?.message ?? "Portal session failed" }, { status: 500 });
  }

  return NextResponse.json({ url: data.url });
}
