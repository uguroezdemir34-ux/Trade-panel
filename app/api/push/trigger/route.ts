/**
 * POST /api/push/trigger — Tüm subscribed cihazlara zengin push gönder.
 *
 * Çağıranlar: useGoAlerts, usePriceAlarms, useEmergencyStopGuard, reconcile
 * Auth: NEXT_PUBLIC_APP_URL origin kontrolü (dahili endpoint)
 *
 * Payload (opsiyonel):
 *   { kind, title, body, pair, direction, score, url }
 *
 * Subscription'da p256dh + auth varsa RFC 8291 ile şifrelenir.
 * 410/404 dönen expired subscription'lar otomatik silinir.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllSubscriptions, deleteSubscription } from "@/lib/push/db";
import { loadVapidConfig, sendPushToEndpoint } from "@/lib/push/vapid";

export const dynamic = 'force-dynamic';

export interface PushTriggerPayload {
  kind?: string;
  title?: string;
  body?: string;
  pair?: string;
  direction?: string;
  score?: number;
  url?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Dahili origin kontrolü
  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (origin && !origin.startsWith(appUrl)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = loadVapidConfig();
  if (!config) {
    return NextResponse.json({ ok: true, sent: 0, note: "VAPID not configured" });
  }

  // Payload parse (body olmayabilir)
  let reqPayload: PushTriggerPayload = {};
  try {
    reqPayload = (await req.json()) as PushTriggerPayload;
  } catch {
    /* body yok veya geçersiz JSON — boş ping ile devam et */
  }

  const notifyJson = JSON.stringify({
    title:
      reqPayload.title ??
      buildTitle(reqPayload.kind, reqPayload.pair, reqPayload.direction),
    body:
      reqPayload.body ??
      buildBody(reqPayload.kind, reqPayload.score),
    kind: reqPayload.kind ?? "go_signal",
    pair: reqPayload.pair,
    direction: reqPayload.direction,
    score: reqPayload.score,
    url: reqPayload.url ?? "/karar",
  });

  const subscriptions = await getAllSubscriptions().catch(() => []);
  if (subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  const expired: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const result = await sendPushToEndpoint(
        sub.endpoint,
        config,
        sub.p256dh && sub.auth
          ? { plaintext: notifyJson, p256dh: sub.p256dh, auth: sub.auth }
          : null,
      );
      if (result.ok) {
        sent++;
      } else if (result.status === 410 || result.status === 404) {
        expired.push(sub.endpoint);
      }
    }),
  );

  // Expired subscription'ları temizle
  await Promise.allSettled(
    expired.map((endpoint) => deleteSubscription(endpoint)),
  );

  return NextResponse.json({ ok: true, sent, expired: expired.length });
}

// ─── Başlık / gövde yardımcıları ──────────────────────────────

function buildTitle(
  kind?: string,
  pair?: string,
  direction?: string,
): string {
  const pairStr = pair ? ` ${pair}` : "";
  const dirEmoji = direction === "LONG" ? "▲" : direction === "SHORT" ? "▼" : "";
  switch (kind) {
    case "go_signal":
      return `⚡ GO${pairStr} ${dirEmoji}`.trim();
    case "price_alarm":
      return `🔔 Fiyat Alarmı${pairStr}`;
    case "sl_hit":
      return `🛑 Stop-Loss${pairStr}`;
    case "trade_closed":
      return `✅ Pozisyon Kapandı${pairStr}`;
    case "score_momentum":
      return `📈 Skor Yükseliyor${pairStr}`;
    case "consecutive_loss":
      return `⚠️ Ardışık Zarar`;
    default:
      return "🚀 QUANTIX OS";
  }
}

function buildBody(kind?: string, score?: number): string {
  switch (kind) {
    case "go_signal":
      return score !== undefined
        ? `Skor: ${score} — GO eşiği aşıldı`
        : "GO sinyali — uygulamayı açın";
    case "price_alarm":
      return "Hedef fiyat seviyesine ulaşıldı";
    case "sl_hit":
      return "Stop-loss tetiklendi — pozisyon kapatıldı";
    case "trade_closed":
      return "Borsa reconcile — pozisyon kapandı";
    case "score_momentum":
      return "Skor hızla yükseliyor — yakında GO";
    case "consecutive_loss":
      return "Ardışık zarar alarmı — trading'i inceleyin";
    default:
      return "Yeni sinyal — uygulamayı açın";
  }
}
