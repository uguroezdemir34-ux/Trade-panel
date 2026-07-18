import type { BalanceFetchResult, BalanceFetchError } from "@/lib/okx/balance";

interface GateioAccountResponse {
  total: string;
  available: string;
}

interface GateioProxyResponse {
  ok: boolean;
  data?: unknown;
  label?: string;
  message?: string;
}

export async function fetchGateioBalance(
  clientCreds: { key: string; secret: string } | null,
): Promise<BalanceFetchResult | BalanceFetchError> {
  try {
    const res = await fetch("/api/gateio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/api/v4/futures/usdt/accounts",
        params: {},
        clientCreds,
      }),
    });
    if (!res.ok) return { ok: false, err: `HTTP_${res.status}` };

    const proxy = (await res.json()) as GateioProxyResponse;
    if (!proxy.ok) return { ok: false, err: proxy.label ?? "PROXY_ERROR" };

    const data = proxy.data as GateioAccountResponse | null;
    if (!data) return { ok: false, err: "NO_DATA" };

    const total = parseFloat(data.total);
    const free = parseFloat(data.available);

    if (!Number.isFinite(total) || !Number.isFinite(free)) {
      return { ok: false, err: "PARSE_NaN" };
    }

    return { ok: true, total, free };
  } catch (e) {
    return { ok: false, err: (e as Error)?.message ?? "UNKNOWN" };
  }
}
