/**
 * TELEGRAM FORMATTER — NotifyMessage → Markdown V2 string.
 *
 * Her notify kind için ayrı format. Tüm değişken kısımlar escape edilir.
 *
 * QUANTIX marka stili: 🚨 emoji + bold pair + monospace fiyat + reason.
 * Mesaj kısa ve okunabilir — VIP üye telefonda 5 saniyede okur.
 */

import type { NotifyMessage } from "@/lib/notify/types";
import type { HumanTraderCheckResult } from "@/lib/signal/humanTraderCheck";
import {
  escapeMarkdownV2,
  formatUsdMd2,
  formatPctMd2,
  bold,
} from "./escape";

/**
 * Ana formatter — kind'a göre dispatch.
 */
export function formatNotifyMessage(msg: NotifyMessage): string {
  switch (msg.kind) {
    case "trade_opened":
      return formatTradeOpened(msg);
    case "trade_closed":
      return formatTradeClosed(msg);
    case "sl_hit":
      return formatSlHit(msg);
    case "tp_hit":
      return formatTpHit(msg);
    case "lock_triggered":
      return formatLockTriggered(msg);
    case "go_signal":
      return formatGoSignal(msg);
    case "price_alarm":
      return formatPriceAlarm(msg);
    case "score_momentum":
      return formatScoreMomentum(msg);
    case "consecutive_loss":
      return formatConsecutiveLoss(msg);
    case "sl_proximity":
      return formatSlProximity(msg);
    case "position_risk_violation":
      return formatPositionRiskViolation(msg);
    case "test":
      return formatTest(msg);
    default: {
      const _exhaustive: never = msg.kind;
      throw new Error(`Unknown notify kind: ${_exhaustive}`);
    }
  }
}

// ═══════════════ TRADE OPENED ═══════════════

function formatTradeOpened(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("🚨 " + bold("QUANTIX SIGNAL"));
  lines.push("");

  // Pair + Direction
  const dirEmoji = msg.direction === "LONG" ? "▲" : "▼";
  const dirText = msg.direction === "LONG" ? "LONG" : "SHORT";
  const entryStr = msg.entry !== undefined ? formatUsdMd2(msg.entry) : "—";
  lines.push(
    `${dirEmoji} ${bold(msg.pair ?? '—')} ${escapeMarkdownV2(dirText)} @ ${entryStr}`,
  );

  // SL
  if (msg.stopPrice !== undefined && msg.entry !== undefined) {
    const slPct = (msg.stopPrice - msg.entry) / msg.entry;
    lines.push(
      `🛑 Stop: ${formatUsdMd2(msg.stopPrice)} \\(${formatPctMd2(slPct)}\\)`,
    );
  } else if (msg.stopPrice !== undefined) {
    lines.push(`🛑 Stop: ${formatUsdMd2(msg.stopPrice)}`);
  }

  // TP1
  if (msg.tp1 !== undefined && msg.entry !== undefined) {
    const tp1Pct = (msg.tp1 - msg.entry) / msg.entry;
    lines.push(
      `🎯 TP1: ${formatUsdMd2(msg.tp1)} \\(${formatPctMd2(tp1Pct)}\\)`,
    );
  } else if (msg.tp1 !== undefined) {
    lines.push(`🎯 TP1: ${formatUsdMd2(msg.tp1)}`);
  }

  // TP2
  if (msg.tp2 !== undefined && msg.entry !== undefined) {
    const tp2Pct = (msg.tp2 - msg.entry) / msg.entry;
    lines.push(
      `🎯 TP2: ${formatUsdMd2(msg.tp2)} \\(${formatPctMd2(tp2Pct)}\\)`,
    );
  }

  lines.push("");

  // Skor
  if (msg.score !== undefined) {
    lines.push(`📊 Score: ${bold(msg.score + "/100")}`);
  }

  // Sebep
  if (msg.reasonText) {
    lines.push(`💡 ${escapeMarkdownV2(msg.reasonText)}`);
  }

  // Zaman
  if (msg.timestamp !== undefined) {
    const date = new Date(msg.timestamp);
    const timeStr = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())} UTC`;
    lines.push(`⏰ ${escapeMarkdownV2(timeStr)}`);
  }

  // İnsan trader kontrolü — sadece VIP (bu fonksiyonun tek çağıranı
  // app/api/telegram/signal/route.ts'in VIP yolu), Stop/TP1/TP2 dahil.
  // formatHumanCheckNumbers() DÜZ metin döner (public trade_opened
  // caption'ı MarkdownV2 DEĞİL — bkz. o fonksiyonun dosya-başı yorumu),
  // burada MarkdownV2 bağlamı olduğu için satır satır escape ediliyor.
  if (msg.humanCheck) {
    const checkLines = formatHumanCheckNumbers(msg.humanCheck, true).map(escapeMarkdownV2);
    if (checkLines.length > 0) {
      lines.push("");
      lines.push(...checkLines);
    }
  }

  // Hashtag
  lines.push("");
  lines.push(`\\#${escapeMarkdownV2(msg.pair ?? '—')} \\#${escapeMarkdownV2(dirText)}`);

  return lines.join("\n");
}

// ═══════════════ TRADE CLOSED ═══════════════

function formatTradeClosed(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("✅ " + bold("POSITION CLOSED"));
  lines.push("");
  lines.push(bold(msg.pair ?? '—') + (msg.direction ? " " + escapeMarkdownV2(msg.direction) : ""));

  if (msg.pnl !== undefined) {
    const sign = msg.pnl >= 0 ? "+" : "";
    lines.push(`💰 P&L: ${escapeMarkdownV2(sign + msg.pnl.toFixed(2) + " USDT")}`);
  }
  if (msg.pnlPct !== undefined) {
    lines.push(`📈 ${formatPctMd2(msg.pnlPct)}`);
  }
  return lines.join("\n");
}

// ═══════════════ SL HIT ═══════════════

function formatSlHit(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("🛑 " + bold("STOP-LOSS TRIGGERED"));
  lines.push("");
  lines.push(bold(msg.pair ?? '—'));
  if (msg.pnl !== undefined) {
    lines.push(`Loss: ${escapeMarkdownV2(msg.pnl.toFixed(2) + " USDT")}`);
  }
  if (msg.pnlPct !== undefined) {
    lines.push(formatPctMd2(msg.pnlPct));
  }
  return lines.join("\n");
}

// ═══════════════ TP HIT ═══════════════

function formatTpHit(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("🎯 " + bold("TAKE-PROFIT TRIGGERED"));
  lines.push("");
  lines.push(bold(msg.pair ?? '—'));
  if (msg.pnl !== undefined) {
    lines.push(`Profit: ${escapeMarkdownV2("+" + msg.pnl.toFixed(2) + " USDT")}`);
  }
  if (msg.pnlPct !== undefined) {
    lines.push(formatPctMd2(msg.pnlPct));
  }
  return lines.join("\n");
}

// ═══════════════ LOCK TRIGGERED ═══════════════

function formatLockTriggered(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("⛔ " + bold("DISCIPLINE LOCK"));
  lines.push("");
  if (msg.reasonText) {
    lines.push(escapeMarkdownV2(msg.reasonText));
  }
  return lines.join("\n");
}

// ═══════════════ GO SIGNAL ═══════════════

/** Ortak gövde — VIP (Stop/TP1/TP2 dahil) ve public (dahil değil) ikisi de
 *  aynı başlık/pair/skor/gerekçe satırlarını paylaşıyor, sadece
 *  formatHumanCheckNumbers()'a geçilen includeTradeLevels farklı. */
function formatGoSignalBody(msg: NotifyMessage, includeTradeLevels: boolean): string {
  const lines: string[] = [];
  lines.push("⚡ " + bold("QUANTIX GO SIGNAL"));
  lines.push("");
  const dir = msg.direction === "LONG" ? "▲ LONG" : msg.direction === "SHORT" ? "▼ SHORT" : "";
  lines.push(`${bold(msg.pair ?? '—')}${dir ? " " + escapeMarkdownV2(dir) : ""}`);
  if (msg.score !== undefined) {
    lines.push(escapeMarkdownV2(`Score: ${msg.score}`));
  }
  if (msg.reasonText) {
    lines.push("");
    lines.push(escapeMarkdownV2(msg.reasonText));
  }
  if (msg.humanCheck) {
    // formatGoSignal (VIP) VE formatGoSignalPublic ikisi de sendMessage
    // (parse_mode: MarkdownV2, sabit — lib/notify/telegram/client.ts)
    // üzerinden gidiyor, bu yüzden ikisi de escape edilmiş satır istiyor
    // (formatTradeOpened'in aksine, o VIP'te sendPhoto+markdownV2:true,
    // ama public'te buildShareText+düz metin — orada escape YOK).
    const checkLines = formatHumanCheckNumbers(msg.humanCheck, includeTradeLevels).map(escapeMarkdownV2);
    if (checkLines.length > 0) {
      lines.push("");
      lines.push(...checkLines);
    }
  }
  return lines.join("\n");
}

function formatGoSignal(msg: NotifyMessage): string {
  return formatGoSignalBody(msg, true);
}

/**
 * PUBLIC KANAL — Stop/TP1/TP2 fiyat değerleri HİÇ YOK (bkz.
 * app/api/telegram/signal/route.ts dosya başı yorumu: "TP/SL/giriş/R:R
 * (fiyat değeri) = İŞLEM TALİMATI, halka açık kanala hiç gitmez"). S/R
 * seviyeleri/hacim/R:R ORANI (fiyat değil, sadece oran) analiz çıktısı
 * sayıldığı için dahil. app/api/cron/signal-check/route.ts'in
 * sendToVipAndPublic()'i (AYNI metin iki kanala) BİLEREK burada
 * kullanılmıyor — o route'un mesajları zaten hiç TP/SL içermiyordu, bu
 * route'unki (useGoAlerts.ts'in go_signal'ı, humanCheck eklendikten sonra)
 * artık Stop/TP taşıyabiliyor, o yüzden ayrı bir "public-safe" varyant
 * gerekti.
 */
export function formatGoSignalPublic(msg: NotifyMessage): string {
  return formatGoSignalBody(msg, false);
}

// ═══════════════ PRICE ALARM ═══════════════

function formatPriceAlarm(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("🔔 " + bold("PRICE ALARM"));
  lines.push("");
  const conditionText = msg.reasonText ?? "";
  const priceStr = msg.entry !== undefined ? formatUsdMd2(msg.entry) : "—";
  const targetStr = msg.tp1 !== undefined ? formatUsdMd2(msg.tp1) : "—";
  lines.push(`${bold(msg.pair ?? '—')} ${escapeMarkdownV2(conditionText)}`);
  lines.push(`Target: ${targetStr} → Current: ${priceStr}`);
  if (msg.timestamp !== undefined) {
    const date = new Date(msg.timestamp);
    const timeStr = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())} UTC`;
    lines.push(`⏰ ${escapeMarkdownV2(timeStr)}`);
  }
  return lines.join("\n");
}

// ═══════════════ SCORE MOMENTUM ═══════════════

function formatScoreMomentum(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("📈 " + bold("SCORE MOMENTUM"));
  lines.push("");
  const dirEmoji = msg.direction === "LONG" ? "▲" : msg.direction === "SHORT" ? "▼" : "◆";
  const riseStr = msg.rise !== undefined ? `\\+${msg.rise}` : "";
  lines.push(`${dirEmoji} ${bold(msg.pair ?? '—')} — Score: ${bold(String(msg.score ?? "—"))} ${escapeMarkdownV2(riseStr)}`);
  lines.push(escapeMarkdownV2("Approaching GO threshold — watch it"));
  if (msg.timestamp !== undefined) {
    const date = new Date(msg.timestamp);
    const timeStr = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())} UTC`;
    lines.push(`⏰ ${escapeMarkdownV2(timeStr)}`);
  }
  return lines.join("\n");
}

// ═══════════════ CONSECUTIVE LOSS ═══════════════

function formatConsecutiveLoss(msg: NotifyMessage): string {
  const lines: string[] = [];
  const isCritical = (msg.streak ?? 0) >= 5;
  lines.push((isCritical ? "🛑" : "⚠️") + " " + bold("CONSECUTIVE LOSS ALERT"));
  lines.push("");
  lines.push(escapeMarkdownV2(`${msg.streak ?? "?"} consecutive losses detected`));
  lines.push("");
  if (msg.reasonText) {
    lines.push(escapeMarkdownV2(msg.reasonText));
  }
  if (msg.timestamp !== undefined) {
    const date = new Date(msg.timestamp);
    const timeStr = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())} UTC`;
    lines.push(`⏰ ${escapeMarkdownV2(timeStr)}`);
  }
  return lines.join("\n");
}

// ═══════════════ SL PROXIMITY ═══════════════

function formatSlProximity(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("⚠️ " + bold("SL YAKLAŞIYOR"));
  lines.push("");
  const dirLabel = msg.direction === "LONG" ? "LONG ↓" : "SHORT ↑";
  lines.push(bold(`${msg.pair ?? "—"} · ${escapeMarkdownV2(dirLabel)}`));
  if (msg.entry !== undefined) {
    lines.push(`Fiyat: ${formatUsdMd2(msg.entry)}`);
  }
  if (msg.stopPrice !== undefined) {
    lines.push(`SL: ${formatUsdMd2(msg.stopPrice)}`);
  }
  if (msg.reasonText) {
    lines.push(escapeMarkdownV2(msg.reasonText));
  }
  return lines.join("\n");
}

// ═══════════════ POSITION RISK VIOLATION ═══════════════

function formatPositionRiskViolation(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("🚨 " + bold("POZİSYON RİSK İHLALİ"));
  lines.push("");
  const dirLabel = msg.direction === "LONG" ? "LONG" : msg.direction === "SHORT" ? "SHORT" : "";
  lines.push(bold(`${msg.pair ?? "—"}${dirLabel ? " " + escapeMarkdownV2(dirLabel) : ""}`));
  if (msg.reasonText) {
    lines.push(escapeMarkdownV2(msg.reasonText));
  }
  if (msg.timestamp !== undefined) {
    const date = new Date(msg.timestamp);
    const timeStr = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())} UTC`;
    lines.push(`⏰ ${escapeMarkdownV2(timeStr)}`);
  }
  return lines.join("\n");
}

// ═══════════════ TEST ═══════════════

function formatTest(_msg: NotifyMessage): string {
  return (
    bold("QUANTIX Telegram Test") +
    "\n\n" +
    escapeMarkdownV2("Bot connection working ✓")
  );
}

// ═══════════════ HUMAN TRADER CHECK — SAYISAL DETAY SATIRLARI ═══════════════

/**
 * checkHumanTraderApprovalAtFireTime()'ın (lib/signal/humanTraderCheck.ts)
 * sonucunu DÜZ, ESCAPE EDİLMEMİŞ metin satırlarına çevirir.
 *
 * BİLEREK escape edilmiş DÖNMÜYOR — iki farklı gönderim bağlamında
 * kullanılıyor: MarkdownV2 (formatTradeOpened/formatGoSignalBody — satır
 * satır escapeMarkdownV2() ile sarıyorlar) VE düz metin (public trade_opened
 * caption'ı, buildShareText çıktısı gibi hiç escape edilmemiş —
 * app/api/telegram/signal/route.ts'in sendToPublicChannel()'ı). Escape
 * kararı ÇAĞIRANA bırakıldı, burada tek bir doğru cevap yok.
 *
 * includeTradeLevels=false iken Stop/TP1/TP2 FİYAT DEĞERLERİ hiç
 * üretilmez — halka açık kanala "işlem talimatı" sızmaması için (bkz.
 * formatGoSignalPublic() ve route.ts'in sendToPublicChannel() çağrı
 * yorumları).
 */
export function formatHumanCheckNumbers(
  check: HumanTraderCheckResult,
  includeTradeLevels: boolean,
): string[] {
  const lines: string[] = [];
  const { srCheck, volumeCheck, rrCheck } = check;

  if (srCheck.nearestResistance) {
    lines.push(
      `🔺 Direnç: $${srCheck.nearestResistance.price.toLocaleString("en-US", { maximumFractionDigits: 2 })} (${srCheck.nearestResistance.distance_pct.toFixed(2)}% uzakta)`,
    );
  }
  if (srCheck.nearestSupport) {
    lines.push(
      `🔻 Destek: $${srCheck.nearestSupport.price.toLocaleString("en-US", { maximumFractionDigits: 2 })} (${srCheck.nearestSupport.distance_pct.toFixed(2)}% uzakta)`,
    );
  }
  if (volumeCheck.volRatio !== null) {
    lines.push(`📶 Hacim: ${volumeCheck.volRatio.toFixed(2)}x`);
  }
  if (rrCheck.rr1 !== null) {
    lines.push(`⚖️ R:R: ${rrCheck.rr1.toFixed(2)}`);
  }
  if (includeTradeLevels) {
    if (rrCheck.stopPrice !== null) {
      lines.push(`🛑 Stop: $${rrCheck.stopPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
    }
    if (rrCheck.tp1Price !== null) {
      lines.push(`🎯 TP1: $${rrCheck.tp1Price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
    }
    if (rrCheck.tp2Price !== null) {
      lines.push(`🎯 TP2: $${rrCheck.tp2Price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
    }
  }
  return lines;
}

// ═══════════════ HELPERS ═══════════════

function pad2(n: number): string {
  return n < 10 ? "0" + n : n.toString();
}
