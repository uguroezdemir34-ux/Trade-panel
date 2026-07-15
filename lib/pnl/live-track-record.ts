/**
 * LIVE TRACK RECORD — server-only servis: SADECE Supabase `trades`
 * tablosundaki, OKX'e karşı fiilen doğrulanmış (reconcile edilmiş) gerçek
 * kapanmış trade'lerden Win Rate / Profit Factor / Max Drawdown / Sharpe
 * hesaplar.
 *
 * KASITLI OLARAK KULLANILMAYAN VERİ: localStorage'daki backtest/scan
 * sonuçları (lib/store/backtestStore.ts, HistoricalEdge.tsx'in kaynağı).
 * Bunlar %100 SİMÜLE veri — geçmiş mumlar üzerinde skor motoru tekrar
 * çalıştırılıyor, gerçek işlem değil — ve devtools'tan client-side elle
 * değiştirilebilir (localStorage, sunucu doğrulaması yok). Bu dosya
 * onlara hiç dokunmuyor, import bile etmiyor — "manipüle edilemez"
 * hedefiyle taban tabana zıt bir kaynak.
 *
 * "OKX-doğrulanmış" tanımı — mevcut veri modeliyle en dürüst filtre:
 * `orderId !== undefined`. Bunun neden güvenilir bir sinyal olduğu (bkz.
 * ANALYSIS.md §4): EXECUTION_MODE=LIVE olsa bile canlı emir açma kod yolu
 * şu an UYGULANMAMIŞ (lib/exchange/index.ts sadece throw eden bir stub) —
 * yani bugünkü sistemde bir TradeSnapshot.orderId'nin TEK mümkün kaynağı
 * OKX reconcile akışı: importOrphanTrade() (OKX orders-history'den
 * birebir) veya patchFromReconcile()'ın açık/bekleyen bir trade'i OKX
 * gerçeğiyle kapatırken atadığı okxOrderId (lib/store/tradesStore.ts,
 * "isOpen" dalı, satır ~434). Hiç reconcile edilmemiş "manual"/"bot"
 * kaynaklı trade'ler orderId TAŞIMAZ — bu filtre onları otomatik eler.
 *
 * DÜRÜSTLÜK NOTU: bir kapanmış trade'in salt Supabase `trades` tablosunda
 * bulunması TEK BAŞINA "doğrulanmış" anlamına gelmez — `/api/trades`
 * POST endpoint'i sadece "bu Clerk userId kendi trade'ini mi yazıyor"
 * kontrolü yapar, OKX'e karşı bir cross-check yapmaz. Gerçek doğrulama
 * SADECE OKX orders-history ile fiilen reconcile edilmiş (orderId dolu)
 * kayıtlar için geçerlidir — bu servis SADECE onları sayar.
 *
 * SERVER-ONLY: lib/db/trades.ts → lib/db/server.ts service-role key
 * kullanır. "use client" bileşenlerden ASLA import edilmemeli (bkz.
 * lib/db/server.ts dosya başı uyarısı — aynı kısıt burada da geçerli).
 *
 * lib/score/'a HİÇ dokunmuyor — sadece zaten var olan lib/pnl/stats.ts
 * (computePnlStats) ve lib/pnl/equity.ts (computeEquityCurve) saf
 * fonksiyonlarını, sunucu tarafından okunan gerçek trade verisiyle çağırır.
 */

import { getTradesForUser } from "@/lib/db/trades";
import { computePnlStats, emptyPnlStats } from "./stats";
import { computeEquityCurve, type EquityPoint } from "./equity";
import type { TradeRecord, PnlStats } from "./types";
import type { TradeSnapshot } from "@/lib/trades/types";

export interface LiveTrackRecordResult {
  stats: PnlStats;
  equityPoints: EquityPoint[];
  /** OKX'e karşı fiilen doğrulanmış, hesaba katılan trade sayısı. */
  verifiedTradeCount: number;
  /** Toplam kapanmış trade sayısı (doğrulanmamışlar dahil) — şeffaflık için gösterilmeli. */
  totalClosedTradeCount: number;
  /** En son doğrulanmış trade'in kapanış zamanı (epoch ms) — hiç yoksa null. */
  lastVerifiedAt: number | null;
}

/**
 * OKX-doğrulanmış mı? Bkz. dosya başı yorum — mevcut veri modelinde
 * `orderId` SADECE reconcile akışından geliyor.
 */
function isOkxVerified(t: TradeSnapshot): boolean {
  return t.status === "closed" && t.exit != null && t.orderId !== undefined;
}

/** app/pnl/page.tsx'teki TradeSnapshot→TradeRecord mapper'ıyla AYNI alan eşlemesi. */
function toTradeRecord(t: TradeSnapshot): TradeRecord {
  const reason = t.exit!.reason;
  return {
    closedAt: t.exit!.closedAt,
    openedAt: t.openedAt,
    pair: t.pair,
    direction: t.direction,
    pnlUsd: t.exit!.pnlUsd,
    pnlPct: t.exit!.pnlPct,
    score: t.entryContext.score,
    // TradeRecord.closeReason (lib/pnl/types.ts) ExitReason'ın (lib/trades/
    // types.ts) bir alt kümesi — "equity_halt" (Equity Curve circuit
    // breaker'ının zorla kapatması) kapsamda değil, pre-existing dar bir
    // tip (app/pnl/page.tsx'in kendi mapper'ında da aynı eksiklik var,
    // sadece orada node_modules eksikliğinden gelen `any` kademesi bunu
    // maskeliyor). En yakın semantik karşılık — TP/SL/trail DIŞI, zorla
    // kapatma — "manual"a düşürülüyor; hesaplamayı etkilemiyor (winRate/PF/
    // Sharpe SADECE pnlUsd/rMultiple'a bakıyor, closeReason'a değil).
    closeReason: reason === "equity_halt" ? "manual" : reason,
    rMultiple: t.exit!.rMultiple,
  };
}

/**
 * Verilen kullanıcının OKX-doğrulanmış, kapanmış trade'lerinden Win Rate/
 * Profit Factor/Max Drawdown/Sharpe + equity curve hesaplar.
 *
 * Hangi userId'nin "public track record" olarak gösterileceğine (tek bir
 * kurucu hesabı mı, çoklu kullanıcı mı) bu fonksiyon KARAR VERMEZ — bu bir
 * ürün kararı, caller (API route/sayfa) tarafından çözülmeli.
 */
export async function computeLiveTrackRecord(
  userId: string,
): Promise<LiveTrackRecordResult> {
  const allTrades = await getTradesForUser(userId);
  const closed = allTrades.filter((t) => t.status === "closed" && t.exit != null);
  const verified = closed.filter(isOkxVerified);

  if (verified.length === 0) {
    return {
      stats: emptyPnlStats(),
      equityPoints: [],
      verifiedTradeCount: 0,
      totalClosedTradeCount: closed.length,
      lastVerifiedAt: null,
    };
  }

  const records = verified.map(toTradeRecord);
  const stats = computePnlStats(records);
  const equityPoints = computeEquityCurve(records);
  const lastVerifiedAt = Math.max(...verified.map((t) => t.exit!.closedAt));

  return {
    stats,
    equityPoints,
    verifiedTradeCount: verified.length,
    totalClosedTradeCount: closed.length,
    lastVerifiedAt,
  };
}
