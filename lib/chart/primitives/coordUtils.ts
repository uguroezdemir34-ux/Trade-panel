/**
 * Koordinat dönüşüm yardımcıları — null-guard zorunlu.
 * LWC timeToCoordinate / priceToCoordinate görünür aralık dışında null döndürür.
 * Çağıran kod null kontrolünü YAPMAMAZLIK EDEMEZ.
 */

import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";

/** Bar time → CSS pixel x. Görünür aralık dışında null. */
export function timeToX(chart: IChartApi, time: number): number | null {
  return chart.timeScale().timeToCoordinate(time as Time);
}

/** Fiyat → CSS pixel y. Görünür aralık dışında null. */
export function priceToY(series: ISeriesApi<SeriesType>, price: number): number | null {
  return series.priceToCoordinate(price);
}
