/**
 * LOG CVD/VPIN — Shadow-observation endpoint (tarayıcı taraflı GO sinyalleri).
 *
 * useSignalFirehose.ts, GO sinyali ateşlendiğinde CVD/VPIN'i buraya POST
 * eder — best-effort, ana akışı hiç etkilemez. Skor motoruna hiçbir bağı
 * yok, sadece cvd_vpin_observations tablosuna gözlem satırı ekler.
 *
 * Auth yok (tarayıcıdan güvenle taşınamaz) — payload validasyonu + IP
 * başına basit rate limit yeterli kabul edildi (plan aşamasında karar
 * verildi): blast radius düşük, en kötü ihtimalle gölge tabloya çöp satır
 * girer, skor/işlem akışını etkilemez.
 */

import { NextResponse } from "next/server";
import { dbUpsert, isDbConfigured } from "@/lib/db/server";

export const runtime = "nodejs";

const TABLE = "cvd_vpin_observations";

const FLOW_ALIGNMENTS = new Set([
  "strong_align",
  "weak_align",
  "neutral",
  "weak_oppose",
  "strong_oppose",
]);

// Basit sabit-pencere rate limit — IP başına, tek instance içinde bellek-içi.
// Serverless'ta soğuk başlangıç/çoklu instance arasında PAYLAŞILMAZ, yani
// gerçek bir üst sınır garantisi DEĞİL — sadece kaba bir spam filtresi.
// Gölge veri için yeterli kabul edildi (plan aşamasında karar verildi).
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
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

interface LogCvdVpinBody {
  pair?: unknown;
  direction?: unknown;
  ts?: unknown;
  cvd_w1m?: unknown;
  cvd_w5m?: unknown;
  cvd_w15m?: unknown;
  cvd_confluence?: unknown;
  vpin?: unknown;
  flow_alignment?: unknown;
  flow_score_adjustment?: unknown;
  flow_vetoed?: unknown;
}

/** null/undefined → null; finite number → number; başka her şey → undefined (geçersiz) */
function numberOrNull(v: unknown): number | null | undefined {
  if (v === null || v === undefined) return null;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req);
  if (isRateLimited(ip, Date.now())) {
    return NextResponse.json({ success: false, error: "Rate limited" }, { status: 429 });
  }

  let body: LogCvdVpinBody;
  try {
    body = (await req.json()) as LogCvdVpinBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.pair !== "string" || body.pair.trim() === "") {
    return NextResponse.json({ success: false, error: "pair required" }, { status: 400 });
  }
  if (body.direction !== "LONG" && body.direction !== "SHORT") {
    return NextResponse.json({ success: false, error: "direction must be LONG or SHORT" }, { status: 400 });
  }
  if (typeof body.ts !== "number" || !Number.isFinite(body.ts) || body.ts <= 0) {
    return NextResponse.json({ success: false, error: "ts must be a positive number" }, { status: 400 });
  }

  const cvdW1m = numberOrNull(body.cvd_w1m);
  const cvdW5m = numberOrNull(body.cvd_w5m);
  const cvdW15m = numberOrNull(body.cvd_w15m);
  if (cvdW1m === undefined || cvdW5m === undefined || cvdW15m === undefined) {
    return NextResponse.json({ success: false, error: "cvd_w1m/w5m/w15m must be number or null" }, { status: 400 });
  }

  let cvdConfluence: number | null = null;
  if (body.cvd_confluence !== null && body.cvd_confluence !== undefined) {
    if (
      typeof body.cvd_confluence !== "number" ||
      !Number.isInteger(body.cvd_confluence) ||
      body.cvd_confluence < 0 ||
      body.cvd_confluence > 3
    ) {
      return NextResponse.json({ success: false, error: "cvd_confluence must be 0-3 or null" }, { status: 400 });
    }
    cvdConfluence = body.cvd_confluence;
  }

  let vpin: number | null = null;
  if (body.vpin !== null && body.vpin !== undefined) {
    if (typeof body.vpin !== "number" || !Number.isFinite(body.vpin) || body.vpin < 0 || body.vpin > 1) {
      return NextResponse.json({ success: false, error: "vpin must be in [0,1] or null" }, { status: 400 });
    }
    vpin = body.vpin;
  }

  let flowAlignment: string | null = null;
  if (body.flow_alignment !== null && body.flow_alignment !== undefined) {
    if (typeof body.flow_alignment !== "string" || !FLOW_ALIGNMENTS.has(body.flow_alignment)) {
      return NextResponse.json({ success: false, error: "invalid flow_alignment" }, { status: 400 });
    }
    flowAlignment = body.flow_alignment;
  }

  let flowScoreAdjustment: number | null = null;
  if (body.flow_score_adjustment !== null && body.flow_score_adjustment !== undefined) {
    if (
      typeof body.flow_score_adjustment !== "number" ||
      !Number.isInteger(body.flow_score_adjustment) ||
      body.flow_score_adjustment < -10 ||
      body.flow_score_adjustment > 10
    ) {
      return NextResponse.json({ success: false, error: "flow_score_adjustment must be -10..10 or null" }, { status: 400 });
    }
    flowScoreAdjustment = body.flow_score_adjustment;
  }

  let flowVetoed: boolean | null = null;
  if (body.flow_vetoed !== null && body.flow_vetoed !== undefined) {
    if (typeof body.flow_vetoed !== "boolean") {
      return NextResponse.json({ success: false, error: "flow_vetoed must be boolean or null" }, { status: 400 });
    }
    flowVetoed = body.flow_vetoed;
  }

  // Gölge mod: DB yapılandırılmamışsa hatayı büyütme, sessizce 200 dön
  if (!isDbConfigured()) {
    return NextResponse.json({ success: true });
  }

  try {
    await dbUpsert(TABLE, {
      pair: body.pair,
      direction: body.direction,
      signal_ts: body.ts,
      cvd_w1m: cvdW1m,
      cvd_w5m: cvdW5m,
      cvd_w15m: cvdW15m,
      cvd_confluence: cvdConfluence,
      vpin,
      flow_alignment: flowAlignment,
      flow_score_adjustment: flowScoreAdjustment,
      flow_vetoed: flowVetoed,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[log-cvd-vpin] insert failed:", err);
    return NextResponse.json({ success: false, error: "DB insert failed" }, { status: 500 });
  }
}
