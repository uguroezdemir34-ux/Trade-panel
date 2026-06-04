import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Stripe sends raw body — disable Next.js body parsing
export const runtime = "nodejs";

interface StripeEvent {
  type: string;
  data: {
    object: {
      metadata?: { userId?: string };
      subscription?: string;
    };
  };
}

function verifyStripeSignature(
  rawBody: string,
  header: string,
  secret: string,
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=")),
  ) as Record<string, string>;
  const { t, v1 } = parts;
  if (!t || !v1) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}

async function setClerkPlan(userId: string, plan: "pro" | "free"): Promise<void> {
  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) throw new Error("CLERK_SECRET_KEY not set");

  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${clerkKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ public_metadata: { plan } }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Clerk update failed: ${err}`);
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as StripeEvent;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const userId = event.data.object.metadata?.userId;
        if (userId) await setClerkPlan(userId, "pro");
        break;
      }
      case "customer.subscription.deleted": {
        // Subscription canceled — downgrade to free
        const userId = event.data.object.metadata?.userId;
        if (userId) await setClerkPlan(userId, "free");
        break;
      }
      default:
        // Unhandled event types — acknowledge and move on
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
