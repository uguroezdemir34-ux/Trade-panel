import type { BalanceFetchResult, BalanceFetchError } from "@/lib/okx/balance";

interface MexcAssetRow {
  currency: string;
  /** Toplam equity (unrealized PnL dahil) */
  equity: number | string;
  availableBalance: number | string;
}

interface MexcProxyResponse {
  ok: boolean;
  data?: unknown;
  code?: number;
  message?: string;
}

function num(s: string | number | undefined): number {
  if (s === undefined) return NaN;
  return typeof s === "number" ? s : parseFloat(s);
}

export async function fetchMexcBalance(
  clientCreds: { key: string; secret: string } | null,
): Promise<BalanceFetchResult | BalanceFetchError> {
  try {
    const res = await fetch("/api/mexc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/api/v1/private/account/assets",
        params: {},
        clientCreds,
      }),
    });
    if (!res.ok) return { ok: false, err: `HTTP_${res.status}` };

    const proxy = (await res.json()) as MexcProxyResponse;
    if (!proxy.ok) return { ok: false, err: proxy.message ?? String(proxy.code ?? "PROXY_ERROR") };

    // Yanıt TÜM para birimlerinin listesi (dizi) — USDT girdisini filtrelememiz gerekiyor
    // (KuCoin'in aksine, currency query param'ıyla sunucu tarafında filtrelenmiyor).
    const rows = proxy.data as MexcAssetRow[] | null;
    if (!Array.isArray(rows)) return { ok: false, err: "NO_DATA" };

    const usdt = rows.find((r) => r.currency === "USDT");
    if (!usdt) return { ok: false, err: "NO_USDT_WALLET" };

    const total = num(usdt.equity);
    const free = num(usdt.availableBalance);

    if (!Number.isFinite(total) || !Number.isFinite(free)) {
      return { ok: false, err: "PARSE_NaN" };
    }

    return { ok: true, total, free };
  } catch (e) {
    return { ok: false, err: (e as Error)?.message ?? "UNKNOWN" };
  }
}
