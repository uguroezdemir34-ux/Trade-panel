import type { BalanceFetchResult, BalanceFetchError } from "@/lib/okx/balance";

interface KucoinAccountOverview {
  accountEquity: number | string;
  availableBalance: number | string;
}

interface KucoinProxyResponse {
  ok: boolean;
  data?: unknown;
  code?: string;
  msg?: string;
}

function num(s: string | number | undefined): number {
  if (s === undefined) return NaN;
  return typeof s === "number" ? s : parseFloat(s);
}

export async function fetchKucoinBalance(
  clientCreds: { key: string; secret: string; passphrase: string } | null,
): Promise<BalanceFetchResult | BalanceFetchError> {
  try {
    const res = await fetch("/api/kucoin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // currency=USDT — hesap USDT/XBT/USDC gibi birden çok para birimi
        // cüzdanı tutabiliyor, USDT-M pozisyonlar için doğru cüzdan bu.
        path: "/api/v1/account-overview",
        params: { currency: "USDT" },
        clientCreds,
      }),
    });
    if (!res.ok) return { ok: false, err: `HTTP_${res.status}` };

    const proxy = (await res.json()) as KucoinProxyResponse;
    if (!proxy.ok) return { ok: false, err: proxy.code ?? "PROXY_ERROR" };

    const data = proxy.data as KucoinAccountOverview | null;
    if (!data) return { ok: false, err: "NO_DATA" };

    const total = num(data.accountEquity);
    const free = num(data.availableBalance);

    if (!Number.isFinite(total) || !Number.isFinite(free)) {
      return { ok: false, err: "PARSE_NaN" };
    }

    return { ok: true, total, free };
  } catch (e) {
    return { ok: false, err: (e as Error)?.message ?? "UNKNOWN" };
  }
}
