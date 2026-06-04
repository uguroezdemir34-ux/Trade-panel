/**
 * EXCHANGE ADAPTER FACTORY — aktif borsaya göre adapter döner.
 *
 * settingsStore.activeExchange:
 *   "okx"     → OkxAdapter (demoMode → OKX Demo API)
 *   "binance" → BinanceAdapter (demoMode → isPaper kağıt işlem)
 */

import type { ExchangeAdapter } from "./types";
import { getOkxAdapter } from "./okx-adapter";
import { getBinanceAdapter } from "./binance-adapter";
import { useSettingsStore } from "@/lib/store/settingsStore";

export function getAdapter(demoMode: boolean): ExchangeAdapter {
  const exchange = useSettingsStore.getState().activeExchange ?? "okx";
  if (exchange === "binance") {
    return getBinanceAdapter(demoMode);
  }
  return getOkxAdapter(demoMode);
}
