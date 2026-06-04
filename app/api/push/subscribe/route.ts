/**
 * POST /api/push/subscribe — Push subscription kaydet / sil.
 *
 * Body: { subscription: PushSubscriptionJSON, action: "subscribe"|"unsubscribe" }
 * Yetkilendirme: Clerk auth (giriş zorunlu, guest izin verilmez)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { saveSubscription, deleteSubscription } from "@/lib/push/db";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } };
    action?: string;
  };

  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sub = body.subscription;
  const action = body.action ?? "subscribe";

  if (!sub?.endpoint) {
    return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
  }

  try {
    if (action === "unsubscribe") {
      await deleteSubscription(sub.endpoint);
    } else {
      await saveSubscription({
        endpoint: sub.endpoint,
        user_id: userId,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/push/subscribe]", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
