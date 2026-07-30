import type { ISeriesPrimitivePaneView, Time } from "lightweight-charts";
import type { CrossLine } from "../types";
import { BasePrimitive } from "./base";

interface BitmapScope {
  context: CanvasRenderingContext2D;
  bitmapSize: { width: number; height: number };
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
}
interface DrawTarget {
  useBitmapCoordinateSpace(scope: (s: BitmapScope) => void): void;
}

export class CrossLinePrimitive extends BasePrimitive<CrossLine> {
  paneViews(): readonly ISeriesPrimitivePaneView[] {
    const self = this;
    return [{
      renderer() {
        return {
          draw(target: DrawTarget): void {
            if (!self.chart || !self.series) return;
            const x = self.chart.timeScale().timeToCoordinate(self.data.time as unknown as Time);
            const y = self.series.priceToCoordinate(self.data.price);
            const color = self.data.color ?? "#f59e0b";

            target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio }) => {
              ctx.save();
              ctx.strokeStyle = color;
              ctx.globalAlpha = 0.85;
              ctx.setLineDash([4 * horizontalPixelRatio, 4 * horizontalPixelRatio]);

              // Vertical leg — only if x is visible
              if (x !== null) {
                const xBitmap = Math.round(x * horizontalPixelRatio);
                ctx.lineWidth = horizontalPixelRatio;
                ctx.beginPath();
                ctx.moveTo(xBitmap, 0);
                ctx.lineTo(xBitmap, bitmapSize.height);
                ctx.stroke();
              }

              // Horizontal leg — only if y is visible
              if (y !== null) {
                const yBitmap = Math.round(y * verticalPixelRatio);
                ctx.lineWidth = verticalPixelRatio;
                ctx.beginPath();
                ctx.moveTo(0, yBitmap);
                ctx.lineTo(bitmapSize.width, yBitmap);
                ctx.stroke();
              }

              ctx.restore();
            });
          },
        };
      },
      zOrder(): "bottom" { return "bottom"; },
    }];
  }
}
