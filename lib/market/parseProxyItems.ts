/**
 * OKX proxy yanıtından data array'ini çıkar — dual-format aware.
 *
 * Proxy iki farklı format dönebilir:
 *   1. { ok: true,  data: [...] }  — parseOkxEnvelope sarmalı (aktif proxy)
 *   2. { code: "0", data: [...] }  — ham OKX formatı (geriye dönük uyum)
 *
 * Diğer her durumda null döner → çağıran fallback uygular.
 * Exception fırlatmaz.
 */
export function parseProxyItems(
  raw: Record<string, unknown>,
): Array<Record<string, unknown>> | null {
  // Format 1: proxy sarmalı { ok: true, data: [...] }
  if (raw.ok === true) {
    if (!Array.isArray(raw.data) || raw.data.length === 0) return null;
    return raw.data as Array<Record<string, unknown>>;
  }

  // Format 2: ham OKX veya çift sarmal { code: "0", data: [...] }
  let envelope: Record<string, unknown> = raw;
  if (
    raw.data &&
    typeof raw.data === "object" &&
    !Array.isArray(raw.data)
  ) {
    const nested = raw.data as Record<string, unknown>;
    if (typeof nested.code === "string") envelope = nested;
  }
  if (envelope.code !== "0") return null;
  if (!Array.isArray(envelope.data) || envelope.data.length === 0) return null;
  return envelope.data as Array<Record<string, unknown>>;
}
