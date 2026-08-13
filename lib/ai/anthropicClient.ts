/**
 * PAYLAŞILABİLİR ANTHROPIC İSTEMCİSİ — raw fetch, SDK YOK.
 *
 * app/api/ai/position-check/route.ts'teki callAnthropic()'in (o dosyada
 * kanıtlanmış, production'da çalışan) desenden ÇIKARILDI — bu projede npm
 * install engelli (CLAUDE.md §3), o yüzden resmi @anthropic-ai/sdk yerine
 * doğrudan Messages API'ye fetch atılıyor, dbSelect/dbUpsert deseniyle
 * tutarlı ("no SDK, no npm install needed").
 *
 * app/api/ai/position-check/route.ts BİLEREK değiştirilmedi (kapsam dışı,
 * mevcut/kanıtlanmış koda dokunma riski istenmedi) — bu dosya PARALEL,
 * ikinci bir çağıran (narrateHumanTraderCheck.ts) için, AYNI deseni
 * genelleştirilmiş parametrelerle tekrarlıyor.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const DEFAULT_MODEL = "claude-haiku-4-5";
const DEFAULT_MAX_TOKENS = 300;
const DEFAULT_TIMEOUT_MS = 15_000;

export function isAnthropicConfigured(): boolean {
  return ANTHROPIC_API_KEY.length > 0;
}

export interface AnthropicTextCallOptions {
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * Tek bir system+user mesajı Anthropic Messages API'ye gönderir, düz metin
 * yanıtı döner. Yanıt formatı beklenmedikse (content'te text bloğu yok)
 * veya HTTP hatası varsa THROW EDER — position-check/route.ts'teki
 * callAnthropic() ile aynı davranış, çağıran taraf try/catch ile ele almalı
 * (bkz. narrateHumanTraderCheck.ts — best-effort, null'a düşer).
 */
export async function callAnthropicText(
  systemPrompt: string,
  userMessage: string,
  options: AnthropicTextCallOptions = {},
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  const model = options.model ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
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
