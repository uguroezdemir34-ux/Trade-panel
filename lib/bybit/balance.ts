import type { BalanceFetchResult, BalanceFetchError } from "@/lib/okx/balance";

interface BybitWalletEntry {
  totalEquity: string;
  totalAvailableBalance: string;
  coin?: unknown[];
}

interface BybitProxyResponse {
  ok: boolean;
  data: unknown;
  retCode?: number;
  retMsg?: string;
}

export async function fetchBybitBalance(
  clientCreds: { key: string; secret: string } | null,
): Promise<BalanceFetchResult | BalanceFetchError> {
  try {
    const res = await fetch("/api/bybit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/v5/account/wallet-balance",
        method: "GET",
        params: { accountType: "UNIFIED" },
        clientCreds,
      }),
    });
    if (!res.ok) return { ok: false, err: `HTTP_${res.status}` };

    const proxy = (await res.json()) as BybitProxyResponse;
    if (!proxy.ok) return { ok: false, err: String(proxy.retMsg ?? "PROXY_ERROR") };

    const data = proxy.data as { list?: BybitWalletEntry[] } | null;
    if (!data || !Array.isArray(data.list) || data.list.length === 0) {
      return { ok: false, err: "NO_DATA" };
    }

    const entry = data.list[0];
    const total = parseFloat(entry.totalEquity);
    const free = parseFloat(entry.totalAvailableBalance);

    if (!Number.isFinite(total) || !Number.isFinite(free)) {
      return { ok: false, err: "PARSE_NaN" };
    }

    return { ok: true, total, free };
  } catch (e) {
    return { ok: false, err: (e as Error)?.message ?? "UNKNOWN" };
  }
}
