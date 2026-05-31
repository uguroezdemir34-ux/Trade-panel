/**
 * OKX BALANCE — /api/v5/account/balance USDT bakiyesi.
 *
 * Proxy: GET /api/okx/api/v5/account/balance
 * Response: details[].ccy === "USDT" → availEq (free), eq (total)
 */

export interface BalanceResult {
  total: number;
  free: number;
}

export async function fetchBalance(
  isDemo: boolean,
  clientCreds?: { key: string; secret: string; pass: string } | null,
): Promise<BalanceResult | null> {
  try {
    const headers: Record<string, string> = {
      "X-OKX-Mode": isDemo ? "demo" : "prod",
    };
    if (clientCreds?.key) {
      headers["X-OKX-Client-Key"] = clientCreds.key;
      headers["X-OKX-Client-Secret"] = clientCreds.secret;
      headers["X-OKX-Client-Pass"] = clientCreds.pass;
    }
    const res = await fetch("/api/okx/api/v5/account/balance", {
      method: "GET",
      headers,
    });
    if (!res.ok) return null;

    const raw = (await res.json()) as Record<string, unknown>;

    // Proxy zarfı: { ok, data } veya direkt OKX yanıtı
    const okxData =
      typeof raw.ok === "boolean"
        ? (raw.data as Record<string, unknown> | undefined)
        : raw;

    const details = Array.isArray(
      (okxData as Record<string, unknown> | undefined)?.details,
    )
      ? ((okxData as Record<string, unknown>).details as Array<
          Record<string, unknown>
        >)
      : [];

    const usdt = details.find((d) => d.ccy === "USDT");
    if (!usdt) return null;

    const total = parseFloat(String(usdt.eq ?? "0"));
    const free = parseFloat(String(usdt.availEq ?? "0"));

    if (!Number.isFinite(total) || !Number.isFinite(free)) return null;

    return { total, free };
  } catch {
    return null;
  }
}
