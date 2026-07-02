import type { ISeriesPrimitiveView, Time } from "lightweight-charts";
import type { FibTimeZone } from "../types";
import { BasePrimitive } from "./base";

const FIB_SEQUENCE = [0, 1, 2, 3, 5, 8, 13, 21, 34];

interface BitmapScope {
  context: CanvasRenderingContext2D;
  bitmapSize: { width: number; height: number };
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
}
interface DrawTarget {
  useBitmapCoordinateSpace(scope: (s: BitmapScope) => void): void;
}

export class FibTimeZonePrimitive extends BasePrimitive<FibTimeZone> {
  paneViews(): readonly ISeriesPrimitiveView[] {
    const self = this;
    return [{
      renderer() {
        return {
          draw(target: DrawTarget): void {
            if (!self.chart) return;
            const { time0, time1, color } = self.data;
            const dt = time1 - time0;
            if (dt === 0) return;
            const col = color ?? "#a78bfa";

            target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize, horizontalPixelRatio }) => {
              ctx.save();
              ctx.strokeStyle = col;
              ctx.lineWidth = horizontalPixelRatio;
              ctx.globalAlpha = 0.7;
              ctx.setLineDash([3 * horizontalPixelRatio, 3 * horizontalPixelRatio]);

              const ts = self.chart!.timeScale();

              for (let i = 0; i < FIB_SEQUENCE.length; i++) {
                const t = time0 + FIB_SEQUENCE[i] * dt;
                const x = ts.timeToCoordinate(t as unknown as Time);
                if (x === null) continue; // null guard per line

                const xBitmap = Math.round(x * horizontalPixelRatio);

                ctx.beginPath();
                ctx.moveTo(xBitmap, 0);
                ctx.lineTo(xBitmap, bitmapSize.height);
                ctx.stroke();

                // Label: Fib number at top
                ctx.save();
                ctx.setLineDash([]);
                ctx.globalAlpha = 0.9;
                ctx.fillStyle = col;
                ctx.font = `${Math.round(10 * horizontalPixelRatio)}px monospace`;
                ctx.fillText(String(FIB_SEQUENCE[i]), xBitmap + 2 * horizontalPixelRatio, 14 * horizontalPixelRatio);
                ctx.restore();
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
