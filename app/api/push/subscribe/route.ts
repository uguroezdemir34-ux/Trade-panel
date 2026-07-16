/**
 * POST /api/push/subscribe — Push subscription kaydet / sil.
 *
 * İki şekilde çağrılır:
 *   Web/PWA:  { subscription: PushSubscriptionJSON, action }
 *   Capacitor/FCM: { token: string, action }
 * Yetkilendirme: Clerk auth (giriş zorunlu, guest izin verilmez)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/serverStubs";
import { saveSubscription, deleteSubscription } from "@/lib/push/db";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } };
    token?: string;
    action?: string;
  };

  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subscription: sub, token } = body;
  const action = body.action ?? "subscribe";

  const identity = sub?.endpoint ?? token;
  if (!identity) {
    return NextResponse.json({ error: "Missing subscription or token" }, { status: 400 });
  }

  try {
    if (action === "unsubscribe") {
      await deleteSubscription(identity);
    } else if (sub?.endpoint) {
      await saveSubscription({
        user_id: userId,
        platform: "webpush",
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        token: null,
      });
    } else if (token) {
      await saveSubscription({
        user_id: userId,
        platform: "fcm",
        endpoint: null,
        p256dh: null,
        auth: null,
        token,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/push/subscribe]", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
