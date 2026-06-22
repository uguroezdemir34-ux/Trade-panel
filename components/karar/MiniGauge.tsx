"use client";

/**
 * MINI GAUGE — Pair grid kartları için küçük speedometer.
 *
 * Büyük ScoreGauge'ın sade versiyonu: sadece arc track + zone renkler +
 * progress arc. Bezel / cam / ibre / hub / text YOK. Animasyon YOK.
 * Filter YOK. PAIRS.length kadar kart aynı anda render edilir — performans kritik.
 *
 * Geometri (büyük gauge ile aynı açı sistemi):
 *   viewBox "0 0 56 34", CX=28, CY=32, R=22
 *   s=0 → 7-saat, s=50 → 12-saat, s=100 → 5-saat (270° sweep)
 */

interface MiniGaugeProps {
  score: number;
  goThreshold: number;
}

const CX = 28;
const CY = 32;
const R  = 22;

function pt(s: number): [number, number] {
  const deg = -135 + 2.7 * s;
  const rad = (deg - 90) * Math.PI / 180;
  return [CX + R * Math.cos(rad), CY + R * Math.sin(rad)];
}

function arcPath(from: number, to: number): string {
  const [x1, y1] = pt(from);
  const [x2, y2] = pt(to);
  const large = (to - from) * 2.7 > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function MiniGauge({ score, goThreshold }: MiniGaugeProps): React.ReactElement {
  const v = Math.max(0, Math.min(100, score));
  const gt = Math.max(1, Math.min(99, goThreshold));
  const progressColor = v >= gt ? "#22c55e" : "#ef4444";

  return (
    <svg viewBox="0 0 56 34" className="w-full" aria-hidden="true">
      {/* Track background */}
      <path d={arcPath(0, 100)} fill="none" stroke="#07080e" strokeWidth={3} strokeLinecap="butt" />

      {/* Zone 0→goThreshold: kırmızı (no signal) */}
      <path d={arcPath(0, gt)} fill="none" stroke="#7a1f1f" strokeWidth={1.5} strokeLinecap="butt" />

      {/* Zone goThreshold→100: yeşil (GO bölgesi) */}
      <path d={arcPath(gt, 100)} fill="none" stroke="#1f5a2a" strokeWidth={1.5} strokeLinecap="butt" />

      {/* Progress arc: 0→score, goThreshold'a göre renk */}
      {v >= 1 && (
        <path d={arcPath(0, v)} fill="none" stroke={progressColor} strokeWidth={2} strokeLinecap="butt" />
      )}

      {/* goThreshold tick: beyaz ince çizgi */}
      {(() => {
        const [ax, ay] = pt(gt);
        const deg = -135 + 2.7 * gt;
        const rad = (deg - 90) * Math.PI / 180;
        const innerR = R - 3;
        const outerR = R + 3;
        const ix = CX + innerR * Math.cos(rad);
        const iy = CY + innerR * Math.sin(rad);
        const ox = CX + outerR * Math.cos(rad);
        const oy = CY + outerR * Math.sin(rad);
        return (
          <line
            x1={ix.toFixed(2)} y1={iy.toFixed(2)}
            x2={ox.toFixed(2)} y2={oy.toFixed(2)}
            stroke="#ffffff" strokeWidth="0.8" opacity="0.40"
          />
        );
        void ax; void ay;
      })()}
    </svg>
  );
}
