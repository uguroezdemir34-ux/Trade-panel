/**
 * TELEGRAM FORMATTER — NotifyMessage → Markdown V2 string.
 *
 * Her notify kind için ayrı format. Tüm değişken kısımlar escape edilir.
 *
 * QUANTIX marka stili: 🚨 emoji + bold pair + monospace fiyat + reason.
 * Mesaj kısa ve okunabilir — VIP üye telefonda 5 saniyede okur.
 */

import type { NotifyMessage } from "@/lib/notify/types";
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
  lines.push("🚨 " + bold("QUANTIX SİNYALİ"));
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
    lines.push(`📊 Skor: ${bold(msg.score + "/100")}`);
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

  // Hashtag
  lines.push("");
  lines.push(`\\#${escapeMarkdownV2(msg.pair ?? '—')} \\#${escapeMarkdownV2(dirText)}`);

  return lines.join("\n");
}

// ═══════════════ TRADE CLOSED ═══════════════

function formatTradeClosed(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("✅ " + bold("POZİSYON KAPANDI"));
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
  lines.push("🛑 " + bold("STOP-LOSS TETİKLENDİ"));
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
  lines.push("🎯 " + bold("TAKE-PROFIT TETİKLENDİ"));
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
  lines.push("⛔ " + bold("DİSİPLİN KİLİDİ"));
  lines.push("");
  if (msg.reasonText) {
    lines.push(escapeMarkdownV2(msg.reasonText));
  }
  return lines.join("\n");
}

// ═══════════════ GO SIGNAL ═══════════════

function formatGoSignal(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("⚡ " + bold("QUANTIX GO SİNYALİ"));
  lines.push("");
  const dir = msg.direction === "LONG" ? "▲ LONG" : msg.direction === "SHORT" ? "▼ SHORT" : "";
  lines.push(`${bold(msg.pair ?? '—')}${dir ? " " + escapeMarkdownV2(dir) : ""}`);
  if (msg.score !== undefined) {
    lines.push(escapeMarkdownV2(`Skor: ${msg.score}`));
  }
  if (msg.reasonText) {
    lines.push("");
    lines.push(escapeMarkdownV2(msg.reasonText));
  }
  return lines.join("\n");
}

// ═══════════════ PRICE ALARM ═══════════════

function formatPriceAlarm(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("🔔 " + bold("FİYAT ALARMI"));
  lines.push("");
  const conditionText = msg.reasonText ?? "";
  const priceStr = msg.entry !== undefined ? formatUsdMd2(msg.entry) : "—";
  const targetStr = msg.tp1 !== undefined ? formatUsdMd2(msg.tp1) : "—";
  lines.push(`${bold(msg.pair ?? '—')} ${escapeMarkdownV2(conditionText)}`);
  lines.push(`Hedef: ${targetStr} → Mevcut: ${priceStr}`);
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
  lines.push("📈 " + bold("SKOR MOMENTUMU"));
  lines.push("");
  const dirEmoji = msg.direction === "LONG" ? "▲" : msg.direction === "SHORT" ? "▼" : "◆";
  const riseStr = msg.rise !== undefined ? `\\+${msg.rise}` : "";
  lines.push(`${dirEmoji} ${bold(msg.pair ?? '—')} — Skor: ${bold(String(msg.score ?? "—"))} ${escapeMarkdownV2(riseStr)}`);
  lines.push(escapeMarkdownV2("GO eşiğine yaklaşıyor — izlemede tut"));
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
  lines.push((isCritical ? "🛑" : "⚠️") + " " + bold("ARDIŞIK ZARAR ALARMI"));
  lines.push("");
  lines.push(escapeMarkdownV2(`${msg.streak ?? "?"} ardışık zarar tespit edildi`));
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

// ═══════════════ TEST ═══════════════

function formatTest(_msg: NotifyMessage): string {
  return (
    bold("QUANTIX Telegram Test") +
    "\n\n" +
    escapeMarkdownV2("Bot bağlantısı çalışıyor ✓")
  );
}

// ═══════════════ HELPERS ═══════════════

function pad2(n: number): string {
  return n < 10 ? "0" + n : n.toString();
}
