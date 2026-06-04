import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const { priceId } = await req.json() as { priceId: string };

  if (!priceId || typeof priceId !== "string") {
    return NextResponse.json({ error: "priceId required" }, { status: 400 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Build Stripe Checkout session via REST (no SDK dependency)
  const params = new URLSearchParams({
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    mode: "subscription",
    success_url: `${origin}/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/upgrade?canceled=true`,
    "metadata[userId]": userId,
    "subscription_data[metadata][userId]": userId,
  });
  if (user?.emailAddresses?.[0]?.emailAddress) {
    params.set("customer_email", user.emailAddresses[0].emailAddress);
  }

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${stripeKey}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await stripeRes.json() as { url?: string; error?: { message: string } };

  if (!stripeRes.ok || !data.url) {
    console.error("Stripe checkout error:", data.error);
    return NextResponse.json({ error: data.error?.message ?? "Checkout failed" }, { status: 500 });
  }

  return NextResponse.json({ url: data.url });
}
