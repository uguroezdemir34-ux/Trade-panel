/**
 * DISCORD FORMATTER — NotifyMessage → Discord-flavored markdown string.
 *
 * Discord uses standard markdown: **bold**, *italic*, `code`.
 * No special character escaping required (unlike Telegram V2).
 */

import type { NotifyMessage } from "@/lib/notify/types";

export function formatDiscordMessage(msg: NotifyMessage): string {
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
      return "**QUANTIX Discord Test**\n\nBot connection working ✓";
    default: {
      const _exhaustive: never = msg.kind;
      throw new Error(`Unknown notify kind: ${_exhaustive}`);
    }
  }
}

// ═══════════════ SL PROXIMITY ═══════════════

function formatSlProximity(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("⛔ **SL PROXIMITY WARNING**");
  lines.push("");
  lines.push(`**${msg.pair ?? "—"}** ${msg.direction ?? ""}`);
  if (msg.entry !== undefined) {
    lines.push(`Current: ${fmtUsd(msg.entry)}`);
  }
  if (msg.stopPrice !== undefined) {
    lines.push(`Stop: ${fmtUsd(msg.stopPrice)}`);
  }
  if (msg.reasonText) {
    lines.push(`⚠️ ${msg.reasonText}`);
  }
  return lines.join("\n");
}

// ═══════════════ POSITION RISK VIOLATION ═══════════════

function formatPositionRiskViolation(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("🚨 **POSITION RISK VIOLATION**");
  lines.push("");
  lines.push(`**${msg.pair ?? "—"}**${msg.direction ? " " + msg.direction : ""}`);
  if (msg.reasonText) {
    lines.push(msg.reasonText);
  }
  if (msg.timestamp !== undefined) {
    const d = new Date(msg.timestamp);
    lines.push(`⏰ ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`);
  }
  return lines.join("\n");
}

// ═══════════════ HELPERS ═══════════════

function fmtUsd(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(frac: number): string {
  const sign = frac >= 0 ? "+" : "";
  return sign + (frac * 100).toFixed(2) + "%";
}

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

// ═══════════════ TRADE OPENED ═══════════════

function formatTradeOpened(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("🚨 **QUANTIX SIGNAL**");
  lines.push("");

  const dirEmoji = msg.direction === "LONG" ? "▲" : "▼";
  const entryStr = msg.entry !== undefined ? fmtUsd(msg.entry) : "—";
  lines.push(`${dirEmoji} **${msg.pair ?? "—"}** ${msg.direction ?? ""} @ ${entryStr}`);

  if (msg.stopPrice !== undefined && msg.entry !== undefined) {
    const slPct = (msg.stopPrice - msg.entry) / msg.entry;
    lines.push(`🛑 Stop: ${fmtUsd(msg.stopPrice)} (${fmtPct(slPct)})`);
  } else if (msg.stopPrice !== undefined) {
    lines.push(`🛑 Stop: ${fmtUsd(msg.stopPrice)}`);
  }

  if (msg.tp1 !== undefined && msg.entry !== undefined) {
    const tp1Pct = (msg.tp1 - msg.entry) / msg.entry;
    lines.push(`🎯 TP1: ${fmtUsd(msg.tp1)} (${fmtPct(tp1Pct)})`);
  }

  if (msg.tp2 !== undefined && msg.entry !== undefined) {
    const tp2Pct = (msg.tp2 - msg.entry) / msg.entry;
    lines.push(`🎯 TP2: ${fmtUsd(msg.tp2)} (${fmtPct(tp2Pct)})`);
  }

  lines.push("");

  if (msg.score !== undefined) {
    lines.push(`📊 Score: **${msg.score}/100**`);
  }

  if (msg.reasonText) {
    lines.push(`💡 ${msg.reasonText}`);
  }

  if (msg.timestamp !== undefined) {
    const d = new Date(msg.timestamp);
    lines.push(`⏰ ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`);
  }

  lines.push("");
  lines.push(`#${msg.pair ?? "—"} #${msg.direction ?? ""}`);

  return lines.join("\n");
}

// ═══════════════ TRADE CLOSED ═══════════════

function formatTradeClosed(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("✅ **POSITION CLOSED**");
  lines.push("");
  lines.push(`**${msg.pair ?? "—"}**${msg.direction ? " " + msg.direction : ""}`);
  if (msg.pnl !== undefined) {
    const sign = msg.pnl >= 0 ? "+" : "";
    lines.push(`💰 P&L: ${sign}${msg.pnl.toFixed(2)} USDT`);
  }
  if (msg.pnlPct !== undefined) {
    lines.push(`📈 ${fmtPct(msg.pnlPct)}`);
  }
  return lines.join("\n");
}

// ═══════════════ SL HIT ═══════════════

function formatSlHit(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("🛑 **STOP-LOSS TRIGGERED**");
  lines.push("");
  lines.push(`**${msg.pair ?? "—"}**`);
  if (msg.pnl !== undefined) {
    lines.push(`Loss: ${msg.pnl.toFixed(2)} USDT`);
  }
  if (msg.pnlPct !== undefined) {
    lines.push(fmtPct(msg.pnlPct));
  }
  return lines.join("\n");
}

// ═══════════════ TP HIT ═══════════════

function formatTpHit(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("🎯 **TAKE-PROFIT TRIGGERED**");
  lines.push("");
  lines.push(`**${msg.pair ?? "—"}**`);
  if (msg.pnl !== undefined) {
    lines.push(`Profit: +${msg.pnl.toFixed(2)} USDT`);
  }
  if (msg.pnlPct !== undefined) {
    lines.push(fmtPct(msg.pnlPct));
  }
  return lines.join("\n");
}

// ═══════════════ LOCK TRIGGERED ═══════════════

function formatLockTriggered(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("⛔ **DISCIPLINE LOCK**");
  lines.push("");
  if (msg.reasonText) {
    lines.push(msg.reasonText);
  }
  return lines.join("\n");
}

// ═══════════════ GO SIGNAL ═══════════════

function formatGoSignal(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("⚡ **QUANTIX GO SIGNAL**");
  lines.push("");
  const dir = msg.direction === "LONG" ? "▲ LONG" : msg.direction === "SHORT" ? "▼ SHORT" : "";
  lines.push(`**${msg.pair ?? "—"}**${dir ? " " + dir : ""}`);
  if (msg.score !== undefined) {
    lines.push(`Score: ${msg.score}`);
  }
  if (msg.reasonText) {
    lines.push("");
    lines.push(msg.reasonText);
  }
  return lines.join("\n");
}

// ═══════════════ PRICE ALARM ═══════════════

function formatPriceAlarm(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("🔔 **PRICE ALARM**");
  lines.push("");
  const priceStr = msg.entry !== undefined ? fmtUsd(msg.entry) : "—";
  const targetStr = msg.tp1 !== undefined ? fmtUsd(msg.tp1) : "—";
  lines.push(`**${msg.pair ?? "—"}** ${msg.reasonText ?? ""}`);
  lines.push(`Target: ${targetStr} → Current: ${priceStr}`);
  if (msg.timestamp !== undefined) {
    const d = new Date(msg.timestamp);
    lines.push(`⏰ ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`);
  }
  return lines.join("\n");
}

// ═══════════════ SCORE MOMENTUM ═══════════════

function formatScoreMomentum(msg: NotifyMessage): string {
  const lines: string[] = [];
  lines.push("📈 **SCORE MOMENTUM**");
  lines.push("");
  const dirEmoji = msg.direction === "LONG" ? "▲" : msg.direction === "SHORT" ? "▼" : "◆";
  const riseStr = msg.rise !== undefined ? ` +${msg.rise}` : "";
  lines.push(`${dirEmoji} **${msg.pair ?? "—"}** — Score: **${msg.score ?? "—"}**${riseStr}`);
  lines.push("Approaching GO threshold — watch it");
  if (msg.timestamp !== undefined) {
    const d = new Date(msg.timestamp);
    lines.push(`⏰ ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`);
  }
  return lines.join("\n");
}

// ═══════════════ CONSECUTIVE LOSS ═══════════════

function formatConsecutiveLoss(msg: NotifyMessage): string {
  const lines: string[] = [];
  const isCritical = (msg.streak ?? 0) >= 5;
  lines.push(`${isCritical ? "🛑" : "⚠️"} **CONSECUTIVE LOSS ALERT**`);
  lines.push("");
  lines.push(`${msg.streak ?? "?"} consecutive losses detected`);
  lines.push("");
  if (msg.reasonText) {
    lines.push(msg.reasonText);
  }
  if (msg.timestamp !== undefined) {
    const d = new Date(msg.timestamp);
    lines.push(`⏰ ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`);
  }
  return lines.join("\n");
}
