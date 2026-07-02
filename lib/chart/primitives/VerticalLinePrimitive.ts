/**
 * VerticalLinePrimitive — belirli bir bar time'ında pane canvas'ına dikey çizgi çizer.
 *
 * Davranış:
 *  - Zoom/pan → LWC her frame'de draw() çağırır → timeToCoordinate yeni x'i döndürür → çizgi yapışık kalır
 *  - Görünür aralık dışındaysa timeToCoordinate null döner → sessizce çizme, çökme yok
 *  - DPR (Retina / Android WebView): useBitmapCoordinateSpace ile fiziksel piksel hassasiyeti
 */

import type { ISeriesPrimitiveView, Time } from "lightweight-charts";
import type { VerticalLine } from "../types";
import { BasePrimitive } from "./base";

/** LWC'nin fancy-canvas CanvasRenderingTarget2D arayüzünün kullandığımız alt kümesi. */
interface BitmapScope {
  context: CanvasRenderingContext2D;
  bitmapSize: { width: number; height: number };
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
}

interface DrawTarget {
  useBitmapCoordinateSpace(scope: (s: BitmapScope) => void): void;
}

export class VerticalLinePrimitive extends BasePrimitive<VerticalLine> {
  paneViews(): readonly ISeriesPrimitiveView[] {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return [
      {
        renderer() {
          return {
            draw(target: DrawTarget): void {
              if (!self.chart) return;

              // NULL GUARD — görünür aralık dışında çizme
              const x = self.chart.timeScale().timeToCoordinate(self.data.time as unknown as Time);
              if (x === null) return;

              target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio }) => {
                // CSS pixel → fiziksel piksel (Retina / yüksek DPR ekranlar)
                const xBitmap = Math.round(x * horizontalPixelRatio);

                ctx.save();
                ctx.strokeStyle = self.data.color ?? "#f59e0b";
                ctx.lineWidth = horizontalPixelRatio; // 1 CSS piksel
                ctx.setLineDash([4 * horizontalPixelRatio, 4 * horizontalPixelRatio]);
                ctx.globalAlpha = 0.85;
                ctx.beginPath();
                ctx.moveTo(xBitmap, 0);
                ctx.lineTo(xBitmap, bitmapSize.height);
                ctx.stroke();
                ctx.restore();
              });
            },
          };
        },
        zOrder(): "bottom" {
          return "bottom";
        },
      },
    ];
  }
}
