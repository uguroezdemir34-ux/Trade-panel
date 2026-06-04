/**
 * POST /api/push/trigger — Tüm subscribed browser'lara push gönder.
 *
 * Sadece NEXT_PUBLIC_APP_URL ile aynı origin'den çağrılabilir
 * (dahili endpoint — public değil).
 * 410 dönen (expired) subscription'lar otomatik silinir.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllSubscriptions, deleteSubscription } from "@/lib/push/db";
import { loadVapidConfig, sendPushToEndpoint } from "@/lib/push/vapid";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Simple origin check — internal use only
  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (origin && !origin.startsWith(appUrl)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = loadVapidConfig();
  if (!config) {
    // VAPID not configured → no-op, don't error
    return NextResponse.json({ ok: true, sent: 0, note: "VAPID not configured" });
  }

  const subscriptions = await getAllSubscriptions().catch(() => []);
  if (subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  const expired: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const result = await sendPushToEndpoint(sub.endpoint, config);
      if (result.ok) {
        sent++;
      } else if (result.status === 410 || result.status === 404) {
        expired.push(sub.endpoint);
      }
    }),
  );

  // Clean up expired subscriptions
  await Promise.allSettled(
    expired.map((endpoint) => deleteSubscription(endpoint)),
  );

  return NextResponse.json({ ok: true, sent, expired: expired.length });
}
