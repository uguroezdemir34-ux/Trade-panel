/**
 * BasePrimitive — tüm LWC ISeriesPrimitive uygulamalarının temel sınıfı.
 *
 * Alt sınıf sadece paneViews() metodu tanımlar.
 * chart / series / requestUpdate: attached() ile gelir, detached() ile temizlenir.
 */

import type {
  IChartApi,
  ISeriesApi,
  SeriesType,
  Time,
  ISeriesPrimitive,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
} from "lightweight-charts";

export abstract class BasePrimitive<T extends { id: string }> implements ISeriesPrimitive {
  protected data: T;
  protected chart: IChartApi | null = null;
  protected series: ISeriesApi<SeriesType> | null = null;
  private _requestUpdate: (() => void) | null = null;

  constructor(data: T) {
    this.data = data;
  }

  attached(params: SeriesAttachedParameter<Time, SeriesType>): void {
    this.chart = params.chart;
    this.series = params.series;
    this._requestUpdate = params.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this._requestUpdate = null;
  }

  /** Primitive verisini güncelle ve yeniden çizim tetikle. */
  updateData(patch: Partial<T>): void {
    this.data = { ...this.data, ...patch };
    this._requestUpdate?.();
  }

  abstract paneViews(): readonly ISeriesPrimitivePaneView[];
}
