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

export interface BalanceFetchResult {
  ok: true;
  total: number;
  free: number;
}

export interface BalanceFetchError {
  ok: false;
  err: string;
}

export async function fetchBalance(
  isDemo: boolean,
  clientCreds?: { key: string; secret: string; pass: string } | null,
): Promise<BalanceResult | null> {
  const result = await fetchBalanceDetailed(isDemo, clientCreds);
  if (result.ok) return { total: result.total, free: result.free };
  return null;
}

export async function fetchBalanceDetailed(
  isDemo: boolean,
  clientCreds?: { key: string; secret: string; pass: string } | null,
): Promise<BalanceFetchResult | BalanceFetchError> {
  try {
    let res: Response;
    if (clientCreds?.key) {
      res = await fetch("/api/okx/api/v5/account/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDemo, clientCreds }),
      });
    } else {
      res = await fetch("/api/okx/api/v5/account/balance", {
        method: "GET",
        headers: { "X-OKX-Mode": isDemo ? "demo" : "prod" },
      });
    }
    if (!res.ok) return { ok: false, err: `HTTP_${res.status}` };

    const raw = (await res.json()) as Record<string, unknown>;

    // Proxy zarfı: { ok, data, err } veya { ok, data } array
    if (typeof raw.ok === "boolean" && !raw.ok) {
      return { ok: false, err: String(raw.err ?? "PROXY_ERROR") };
    }

    const proxyData: unknown =
      typeof raw.ok === "boolean" ? raw.data : raw;

    // OKX balance lives at data[0] inside the envelope array
    const okxData: Record<string, unknown> | undefined = Array.isArray(proxyData)
      ? (proxyData[0] as Record<string, unknown> | undefined)
      : (proxyData as Record<string, unknown> | undefined);

    const details = Array.isArray(okxData?.details)
      ? (okxData!.details as Array<Record<string, unknown>>)
      : [];

    const usdt = details.find((d) => d.ccy === "USDT");
    if (!usdt) {
      const ccys = details.map((d) => d.ccy).join(",") || "empty";
      return { ok: false, err: `NO_USDT(ccys:${ccys})` };
    }

    const total = parseFloat(String(usdt.eq ?? "0"));
    const free = parseFloat(String(usdt.availEq ?? "0"));

    if (!Number.isFinite(total) || !Number.isFinite(free)) {
      return { ok: false, err: "PARSE_NaN" };
    }

    return { ok: true, total, free };
  } catch (e) {
    return { ok: false, err: (e as Error)?.message ?? "UNKNOWN" };
  }
}
