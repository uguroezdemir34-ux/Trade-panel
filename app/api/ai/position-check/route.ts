/**
 * POST /api/ai/position-check — "AI'ya Sor": açık bir pozisyonun giriş
 * gerekçesinin hâlâ geçerli olup olmadığını Anthropic API ile değerlendirir.
 *
 * Client zaten hesaplanmış current score/regime/sub-skorları gönderir — bu
 * route YENİ bir skor hesaplamaz, lib/score/*'a hiç dokunmaz. Akış:
 *   1. score_history'den giriş anına (entryCTime) en yakın satırı arar
 *      (lib/db/scoreHistory.ts → getScoreHistoryNear). Bulunamazsa
 *      fabricate ETMEZ — "giriş anı verisi yok" moduna geçer (bkz.
 *      lib/ai/positionCheckPrompt.ts → buildSystemPrompt(false)), yanıta
 *      açık bir `note` ekler.
 *   2. Anthropic Messages API'yi raw fetch ile çağırır — bu projede SDK
 *      kurulumu yok (npm install engelli, CLAUDE.md §3), dbSelect/dbUpsert
 *      deseniyle tutarlı ("no SDK, no npm install needed").
 *   3. Yanıtı "DURUM: <ETIKET>" satırından parse eder — beklenmeyen
 *      formatta ise açık bir hata döner (uydurma sonuç göstermez).
 *
 * Model: claude-haiku-4-5 — bu görev (iki kısa snapshot karşılaştırması,
 * sabit format) Opus'un maliyet/gecikmesini gerektirmiyor, kullanıcıyla
 * chat'te netleştirildi.
 *
 * Rate limit: pozisyon başına (pair_direction_entryCTime) modül-scope Map,
 * COOLDOWN_MS'lik sabit pencere. CAVEAT (kullanıcıya diff caption'ında
 * ayrıca belirtildi): serverless'ta her instance kendi Map'ini tutar —
 * birden fazla instance/cold start senaryosunda bu limit atlanabilir. Bu
 * mükemmel bir global rate-limit DEĞİL, aynı instance'ta art arda tıklamayı
 * engelleyen ucuz bir önlem — client tarafında da ayrıca bir cooldown var
 * (bkz. components/karar/AiCheckButton.tsx), iki katman birlikte pratikte
 * yeterli.
 *
 * Auth: go-signals route'uyla aynı gerekçe — kullanıcıya özel veri
 * yazmıyor/okumuyor, guest modda da çalışması gerekiyor (borsa credentials
 * zaten client tarafında, pozisyon zaten client'ın kendi borsa hesabından
 * geliyor). Clerk auth ZORUNLU değil.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getScoreHistoryNear } from "@/lib/db/scoreHistory";
import {
  buildSystemPrompt,
  buildUserMessage,
  parseAiCheckResponse,
  type ScoreSnapshotForPrompt,
} from "@/lib/ai/positionCheckPrompt";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const ANTHROPIC_MODEL = "claude-haiku-4-5";
const COOLDOWN_MS = 90_000;
const MAX_TRACKED_KEYS = 2_000;

const lastCalledAt = new Map<string, number>();

/** null = izinli (ve bu çağrı şimdi kaydedildi). number = kalan bekleme (ms). */
function checkRateLimit(key: string, nowMs: number): number | null {
  const last = lastCalledAt.get(key);
  if (last !== undefined && nowMs - last < COOLDOWN_MS) {
    return COOLDOWN_MS - (nowMs - last);
  }
  lastCalledAt.set(key, nowMs);
  if (lastCalledAt.size > MAX_TRACKED_KEYS) {
    for (const [k, ts] of lastCalledAt) {
      if (nowMs - ts >= COOLDOWN_MS) lastCalledAt.delete(k);
    }
  }
  return null;
}

const subSchema = z.object({
  trend: z.number(),
  adx: z.number(),
  rsi: z.number(),
  vol: z.number(),
  bb: z.number(),
  vwap: z.number(),
  funding: z.number(),
  macro: z.number(),
});

const snapshotSchema = z.object({
  score: z.number(),
  verdict: z.string(),
  direction: z.string(),
  dirConfidence: z.number(),
  regime: z.string().nullable(),
  blocks: z.array(z.string()),
  softBlocks: z.array(z.string()),
  sub: subSchema,
});

const requestSchema = z.object({
  pair: z.string(),
  direction: z.enum(["LONG", "SHORT"]),
  entryCTime: z.number(),
  currentPrice: z.number(),
  currentPnlPct: z.number(),
  currentSnapshot: snapshotSchema,
});

async function callAnthropic(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Anthropic response missing text content");
  return text;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const positionKey = `${body.pair}_${body.direction}_${body.entryCTime}`;
  const now = Date.now();
  const retryAfterMs = checkRateLimit(positionKey, now);
  if (retryAfterMs !== null) {
    return NextResponse.json({ ok: false, error: "rate_limited", retryAfterMs }, { status: 429 });
  }

  if (!ANTHROPIC_API_KEY) {
    console.warn("[/api/ai/position-check] ANTHROPIC_API_KEY not configured — set it in Vercel env");
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const entryRow = await getScoreHistoryNear(body.pair, body.entryCTime).catch((err: unknown) => {
    console.error("[/api/ai/position-check] getScoreHistoryNear failed", err);
    return null;
  });

  const hasEntryData = entryRow !== null;
  const entrySnapshot: (ScoreSnapshotForPrompt & { price: number; signalTs: number }) | null = entryRow
    ? {
        score: entryRow.score,
        verdict: entryRow.verdict,
        direction: entryRow.direction,
        dirConfidence: undefined,
        regime: entryRow.regime,
        blocks: entryRow.blocks,
        softBlocks: entryRow.softBlocks,
        sub: entryRow.sub,
        price: entryRow.price,
        signalTs: entryRow.signalTs,
      }
    : null;

  const systemPrompt = buildSystemPrompt(hasEntryData);
  const userMessage = buildUserMessage({
    pair: body.pair,
    direction: body.direction,
    entrySnapshot,
    currentSnapshot: body.currentSnapshot,
    currentPrice: body.currentPrice,
    currentPnlPct: body.currentPnlPct,
  });

  try {
    const text = await callAnthropic(systemPrompt, userMessage);
    const parsed = parseAiCheckResponse(text, hasEntryData);
    if (!parsed) {
      console.error("[/api/ai/position-check] unexpected AI response format:", text);
      return NextResponse.json({ ok: false, error: "parse_failed" }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      hasEntryData,
      status: parsed.status,
      message: parsed.message,
      note: hasEntryData
        ? undefined
        : "Giriş anı verisi mevcut değil, sadece güncel duruma göre bilgi veriliyor.",
    });
  } catch (err) {
    console.error("[/api/ai/position-check] Anthropic call failed", err);
    return NextResponse.json({ ok: false, error: "ai_call_failed" }, { status: 502 });
  }
}
