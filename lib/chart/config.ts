export const SERIES_COLORS = {
  up:         "#22c55e",
  down:       "#ef4444",
  ema20:      "#3b82f6",
  ema50:      "#f59e0b",
  ema200:     "#a855f7",
  rsi:        "#ec4899",
  bb:         "#06b6d4",
  vwap:       "#f97316",
  macd:       "#3b82f6",
  macdSignal: "#f59e0b",
  live:       "#3b82f6",
  volUp:      "rgba(34,197,94,0.5)",
  volDown:    "rgba(239,68,68,0.5)",
} as const;

export const THEME_COLORS = {
  dark:  { grid: "#2d2d2d", text: "#a3a3a3", border: "#2d2d2d" },
  light: { grid: "#e5e5e5", text: "#525252",  border: "#e5e5e5" },
} as const;

export const CHART_DEFAULTS = {
  rightOffset: 20,
  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
} as const;

export const PANEL_H = 0.20;
export const BOT_PAD = 0.01;

export function panelMargins(slotFromBottom: number) {
  return {
    top:    1.0 - (slotFromBottom + 1) * PANEL_H - BOT_PAD,
    bottom: slotFromBottom * PANEL_H + BOT_PAD,
  };
}

export function candleMargins(panelCount: number) {
  return { top: 0.03, bottom: panelCount * PANEL_H + BOT_PAD };
}

export function computeSlots(hasVol: boolean, hasRsi: boolean, hasMacd: boolean) {
  const slots: { name: string; slot: number }[] = [];
  let next = 0;
  if (hasMacd) slots.push({ name: "macd",   slot: next++ });
  if (hasRsi)  slots.push({ name: "rsi",    slot: next++ });
  if (hasVol)  slots.push({ name: "volume", slot: next++ });
  return slots;
}
