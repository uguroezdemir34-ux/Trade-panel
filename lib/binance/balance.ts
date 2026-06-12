import type { BalanceFetchResult, BalanceFetchError } from "@/lib/okx/balance";

interface BinanceBalanceRow {
  asset: string;
  balance: string;
  availableBalance: string;
}

interface BinanceProxyResponse {
  ok: boolean;
  data: unknown;
  code?: number;
  msg?: string;
}

export async function fetchBinanceBalance(
  clientCreds: { key: string; secret: string } | null,
): Promise<BalanceFetchResult | BalanceFetchError> {
  try {
    const res = await fetch("/api/binance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/fapi/v2/balance",
        method: "GET",
        params: {},
        clientCreds,
      }),
    });
    if (!res.ok) return { ok: false, err: `HTTP_${res.status}` };

    const proxy = (await res.json()) as BinanceProxyResponse;
    if (!proxy.ok) return { ok: false, err: String(proxy.msg ?? "PROXY_ERROR") };

    if (!Array.isArray(proxy.data)) return { ok: false, err: "NO_DATA" };

    const rows = proxy.data as BinanceBalanceRow[];
    const usdt = rows.find((r) => r.asset === "USDT");
    if (!usdt) return { ok: false, err: "NO_USDT" };

    const total = parseFloat(usdt.balance);
    const free = parseFloat(usdt.availableBalance);

    if (!Number.isFinite(total) || !Number.isFinite(free)) {
      return { ok: false, err: "PARSE_NaN" };
    }

    return { ok: true, total, free };
  } catch (e) {
    return { ok: false, err: (e as Error)?.message ?? "UNKNOWN" };
  }
}
