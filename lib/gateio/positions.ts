import type { Position } from "@/lib/okx/positions";

interface GateioPositionRow {
  /** "BTC_USDT" (Gate.io alt çizgi kullanır, OKX'in "-" ayracının aksine) */
  contract: string;
  /** Kontrat cinsinden, işaretli (+long/-short), 0 = pozisyon yok */
  size: number;
  leverage: string;
  entry_price: string;
  mark_price: string;
  liq_price: string;
  unrealised_pnl: string;
  /** Notional (USDT) — coin-cinsi büyüklüğü türetmek için kullanılıyor */
  value: string;
  /** "single" | "dual_long" | "dual_short" (hedge mode) */
  mode: string;
}

interface GateioProxyResponse {
  ok: boolean;
  data?: unknown;
  label?: string;
  message?: string;
}

function extractPair(contract: string): string {
  return contract.split("_")[0];
}

function num(s: string | number | undefined, fallback = 0): number {
  if (s === undefined) return fallback;
  const n = typeof s === "number" ? s : parseFloat(s);
  return isFinite(n) ? n : fallback;
}

/**
 * Gate.io futures `size` alanı KONTRAT cinsindendir, coin cinsi değil —
 * kontrat başına coin miktarı (multiplier) pariteye göre değişir ve bu
 * entegrasyon kapsamında (salt görüntüleme) ayrıca contract-specs uç noktası
 * sorgulanmıyor. Bunun yerine `value` (USDT notional) / `markPrice` ile
 * coin-cinsi büyüklük TÜRETİLİYOR — multiplier bilinmeden de doğru sonuç
 * verir.
 *
 * NOT: Hedge mode (`mode: "dual_long"/"dual_short"`) hesaplarında `size`
 * işaret konvansiyonu doğrulanmadı (gerçek bir Gate.io hesabıyla test
 * edilmedi) — şu an sadece `size`'ın işaretine (+/-) güveniliyor, single
 * (one-way) mode için doğru olduğu biliniyor.
 */
function parseRow(row: GateioPositionRow): Position | null {
  if (!row.size) return null;

  const pair = extractPair(row.contract);
  if (!pair) return null;

  const entryPx = num(row.entry_price);
  if (entryPx <= 0) return null;

  const markPx = num(row.mark_price, entryPx);
  const notional = Math.abs(num(row.value));
  const size = markPx > 0 ? notional / markPx : 0;

  const direction: Position["direction"] = row.size > 0 ? "LONG" : "SHORT";
  const posSide: Position["posSide"] = direction === "LONG" ? "long" : "short";

  const uplRatio =
    entryPx > 0 ? ((markPx - entryPx) / entryPx) * (direction === "SHORT" ? -1 : 1) : 0;

  const liqPxRaw = num(row.liq_price);

  return {
    instId: row.contract,
    pair,
    posSide,
    direction,
    size,
    entryPx,
    markPx,
    upl: num(row.unrealised_pnl),
    uplRatio,
    leverage: num(row.leverage, 1),
    mgnMode: "cross",
    notional,
    liqPx: liqPxRaw > 0 ? liqPxRaw : null,
    // Gate.io pozisyon listesi SL/TP trigger fiyatı döndürmüyor (OKX/Bybit'in
    // aksine) — bu entegrasyon kapsamında algo-order merge yapılmıyor.
    slTriggerPx: null,
    tpTriggerPx: null,
    // Gate.io pozisyon listesi açılış zamanı döndürmüyor — fetch anı kullanılıyor.
    cTime: Date.now(),
    source: "gateio",
  };
}

export async function fetchGateioPositions(
  clientCreds: { key: string; secret: string } | null,
): Promise<Position[] | null> {
  try {
    const res = await fetch("/api/gateio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/api/v4/futures/usdt/positions",
        params: {},
        clientCreds,
      }),
    });
    if (!res.ok) return null;

    const proxy = (await res.json()) as GateioProxyResponse;
    if (!proxy.ok) return null;

    const rows = proxy.data as GateioPositionRow[] | null;
    if (!Array.isArray(rows)) return null;

    const positions: Position[] = [];
    for (const raw of rows) {
      const p = parseRow(raw);
      if (p) positions.push(p);
    }
    return positions;
  } catch {
    return null;
  }
}
