/**
 * LOG HUMAN CHECK — İnsan trader onay kontrolünün (lib/signal/humanTraderCheck.ts)
 * her sonucunu gölge-gözlem tablosuna yazar (client kaynağı — useScoreEngine.ts).
 *
 * app/api/log-cvd-vpin/route.ts ile AYNI felsefe: skor motoruna hiçbir bağı
 * yok, sadece human_check_observations tablosuna (migration 026/027) satır
 * ekler. Auth yok (tarayıcıdan güvenle taşınamaz) — zod validasyonu + IP
 * başına rate limit yeterli kabul edildi (aynı gerekçe: blast radius düşük,
 * en kötü ihtimalle gölge tabloya çöp satır girer, skor/onay akışını
 * ETKİLEMEZ — lib/signal/humanTraderCheck.ts'in kendisine bu route'ta HİÇ
 * dokunulmadı).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { insertHumanCheckObservation } from "@/lib/db/humanCheckObservations";
import { isDbConfigured } from "@/lib/db/server";

export const runtime = "nodejs";

// log-cvd-vpin'den daha yüksek limit — bu route her "go" verdict'inde
// (sadece yeni geçişte değil, GO sürdüğü her cycle'da) çağrılıyor, tek bir
// pariteden bile 30sn'lik bir cycle'da birden fazla istek gelebilir.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const hitsByIp = new Map<string, { windowStart: number; count: number }>();

function isRateLimited(ip: string, now: number): boolean {
  const entry = hitsByIp.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    hitsByIp.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

const pivotPointSchema = z.object({ price: z.number(), idx: z.number() });

const srLevelEntrySchema = z
  .object({
    price: z.number(),
    type: z.string(),
    strength: z.number(),
    distance_pct: z.number(),
  })
  .nullable();

const humanCheckSchema = z.object({
  approved: z.boolean(),
  dataInsufficient: z.boolean(),
  srCheck: z.object({
    nearestResistance: srLevelEntrySchema,
    nearestSupport: srLevelEntrySchema,
    breakoutConfirmed: z.boolean(),
    blocked: z.boolean(),
  }),
  volumeCheck: z.object({
    volRatio: z.number().nullable(),
    confirmed: z.boolean(),
  }),
  rrCheck: z.object({
    stopPrice: z.number().nullable(),
    tp1Price: z.number().nullable(),
    tp2Price: z.number().nullable(),
    rr1: z.number().nullable(),
    acceptable: z.boolean(),
  }),
  trendLine: z
    .object({
      direction: z.enum(["LONG", "SHORT"]),
      p1: pivotPointSchema,
      p2: pivotPointSchema,
      slope: z.number(),
      currentProjectedPrice: z.number(),
      confirmingPoint: pivotPointSchema.nullable(),
      confirmed: z.boolean(),
    })
    .nullable(),
  reasons: z.array(z.string()),
});

const requestSchema = z.object({
  pair: z.string().min(1),
  direction: z.enum(["LONG", "SHORT"]),
  check: humanCheckSchema,
});

export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req);
  if (isRateLimited(ip, Date.now())) {
    return NextResponse.json({ success: false, error: "Rate limited" }, { status: 429 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: "invalid_body" }, { status: 400 });
  }

  // Gölge mod: DB yapılandırılmamışsa hatayı büyütme, sessizce 200 dön
  // (log-cvd-vpin ile AYNI davranış).
  if (!isDbConfigured()) {
    return NextResponse.json({ success: true });
  }

  try {
    await insertHumanCheckObservation({
      pair: body.pair,
      direction: body.direction,
      source: "client",
      check: body.check,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[log-human-check] insert failed:", err);
    return NextResponse.json({ success: false, error: "DB insert failed" }, { status: 500 });
  }
}
