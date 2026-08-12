/**
 * SCENARIO CHART EXPORT (SUNUCU) — renderScenarioChart()'ı @napi-rs/canvas
 * ile Node üzerinde çizip PNG Buffer üretir. exportShareCardServer.ts ile
 * AYNI desen (createCanvas, toBuffer) — kullanıcı onayıyla mirror'landı.
 *
 * Logo YOK: renderShareCard'ın aksine renderScenarioChart hiç logoImage
 * parametresi almıyor (GO sinyal kartından farklı tasarım) — bu yüzden
 * exportShareCardServer.ts'teki loadLogoImage()/LOGO_PATH eşdeğeri burada
 * yok.
 *
 * Font kaydı — lib/share/fonts.ts'teki registerCardFonts()'a taşındı
 * (kullanıcı kararı, refactor): önceden bu dosya kendi registerFonts()'unu
 * ve CARD_FONT_FAMILY referansını tutuyordu — exportShareCardServer.ts'in
 * kendi (o zaman ayrı) registerFonts()'undan TAMAMEN BAĞIMSIZ bir
 * fontsRegistered flag'i vardı, aynı süreçte ikisi de çalışırsa aynı 4
 * font dosyasının iki kez kaydedilmesi riski (idempotent olduğu
 * doğrulanmamış bir varsayımdı) VARDI. Artık TEK registerCardFonts() +
 * TEK flag (fonts.ts'te) kullanıldığı için bu risk ortadan kalktı.
 */

import { createCanvas } from "@napi-rs/canvas";
import {
  renderScenarioChart,
  SCENARIO_CHART_WIDTH,
  SCENARIO_CHART_HEIGHT,
  type ScenarioChartData,
} from "./renderScenarioChart";
import type { ShareCanvasContext } from "./renderShareCard";
import { registerCardFonts } from "./fonts";

export async function exportScenarioChartPngServer(data: ScenarioChartData): Promise<Buffer> {
  registerCardFonts();

  const canvas = createCanvas(SCENARIO_CHART_WIDTH, SCENARIO_CHART_HEIGHT);
  const ctx = canvas.getContext("2d");

  // Dar cast — renderShareCard.ts'teki ShareCanvasContext yorumu ve
  // exportShareCardServer.ts'teki aynı cast için gerekçe geçerli.
  renderScenarioChart(ctx as unknown as ShareCanvasContext, data);

  return canvas.toBuffer("image/png");
}
