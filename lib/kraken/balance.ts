import type { BalanceFetchResult, BalanceFetchError } from "@/lib/okx/balance";

interface KrakenProxyResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

function num(s: number | string | undefined): number {
  if (s === undefined) return NaN;
  return typeof s === "number" ? s : parseFloat(s);
}

/**
 * ═══════════════════ KRİTİK DOĞRULANMAMIŞ ŞEMA ═══════════════════
 * /derivatives/api/v3/accounts yanıtının TAM alan yapısı bu entegrasyon
 * araştırmasında dokümantasyondan doğrulanamadı — Kraken'in multi-collateral
 * ("flex") hesap yapısı karmaşık, resmi örnek bir yanıt gövdesi bulunamadı.
 * Aşağıdaki alan yolu (`data.accounts.flex.portfolioValue` /
 * `.availableMargin`) EN OLASI aday olarak seçildi ama TEYİT EDİLMEDİ.
 * Eşleşmezse sessizce yanlış bir sayı göstermek yerine PARSE_ERROR ile
 * başarısız olur. GERÇEK BİR KRAKEN HESABIYLA TEST EDİLİP GEREKİRSE
 * DÜZELTİLMELİDİR.
 * ═══════════════════════════════════════════════════════════════
 */
interface KrakenAccountsBody {
  accounts?: {
    flex?: {
      portfolioValue?: number | string;
      availableMargin?: number | string;
    };
  };
}

export async function fetchKrakenBalance(
  clientCreds: { key: string; secret: string } | null,
): Promise<BalanceFetchResult | BalanceFetchError> {
  try {
    const res = await fetch("/api/kraken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/derivatives/api/v3/accounts",
        params: {},
        clientCreds,
      }),
    });
    if (!res.ok) return { ok: false, err: `HTTP_${res.status}` };

    const proxy = (await res.json()) as KrakenProxyResponse;
    if (!proxy.ok) return { ok: false, err: proxy.error ?? "PROXY_ERROR" };

    const body = proxy.data as KrakenAccountsBody | null;
    const flex = body?.accounts?.flex;
    if (!flex) return { ok: false, err: "SCHEMA_UNCONFIRMED" };

    const total = num(flex.portfolioValue);
    const free = num(flex.availableMargin);

    if (!Number.isFinite(total) || !Number.isFinite(free)) {
      return { ok: false, err: "PARSE_NaN" };
    }

    return { ok: true, total, free };
  } catch (e) {
    return { ok: false, err: (e as Error)?.message ?? "UNKNOWN" };
  }
}
