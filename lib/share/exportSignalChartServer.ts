/**
 * SIGNAL CHART EXPORT (SUNUCU) — renderSignalChart()'ı @napi-rs/canvas ile
 * Node üzerinde çizip PNG Buffer üretir. exportScenarioChartServer.ts ile
 * BİREBİR AYNI desen (createCanvas, toBuffer, registerCardFonts) —
 * kasıtlı mirror, üçüncü bir export deseni icat edilmedi.
 */

import { createCanvas } from "@napi-rs/canvas";
import { renderSignalChart, SIGNAL_CHART_WIDTH, SIGNAL_CHART_HEIGHT, type SignalChartData } from "./renderSignalChart";
import type { ShareCanvasContext } from "./renderShareCard";
import { registerCardFonts } from "./fonts";

export async function exportSignalChartPngServer(data: SignalChartData): Promise<Buffer> {
  registerCardFonts();

  const canvas = createCanvas(SIGNAL_CHART_WIDTH, SIGNAL_CHART_HEIGHT);
  const ctx = canvas.getContext("2d");

  // Dar cast — renderShareCard.ts'teki ShareCanvasContext yorumu ve
  // exportShareCardServer.ts/exportScenarioChartServer.ts'teki AYNI cast
  // için gerekçe geçerli.
  renderSignalChart(ctx as unknown as ShareCanvasContext, data);

  return canvas.toBuffer("image/png");
}
