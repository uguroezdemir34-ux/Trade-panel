/**
 * SKOR RENK BANTLARI — merkezi 5-bant renk sistemi.
 *
 * app/karar/page.tsx (aktif kart border'ı), ScoreRingV2.tsx (gradient),
 * ScoreGauge.tsx (iğne/metin) ve ScoreHeatmap.tsx (skor rakamı text
 * rengi — arkaplan DEĞİL, o hâlâ heatmapLayout.ts'teki verdict/direction
 * mantığından geliyor) buradan besleniyor. Saf renk eşlemesi — hesaplama
 * yapmaz, lib/score/*'a hiç dokunmaz.
 *
 * textClass/borderClass literal string olarak yazıldı (template literal
 * DEĞİL) — Tailwind'in JIT content taraması (tailwind.config content:
 * "./lib/**\/*.{ts,tsx}") arbitrary-value class'ları (`text-[#hex]`) sadece
 * kaynak metinde LİTERAL göründüklerinde yakalayabiliyor, runtime'da
 * `${}` ile üretilen string'leri tarayamıyor.
 */

export interface ScoreColorBand {
  /** Ana/koyu hex — gradFrom, needle/metin rengi, border rengi kaynağı. */
  color: string;
  /** Açık varyant — gradTo (ScoreRingV2 gradient), ~%18 beyaza karıştırılmış. */
  lightColor: string;
  textClass: string;
  borderClass: string;
  /** Orijinal bandColors'taki glow-boost davranışı — DÜŞÜK skor bantlarında
   *  true'ydu (wine/crimson, score<40), yüksek bantlarda değil. Yeni 5-bant
   *  sistemde aynı semantik korunuyor: en düşük 2 bant (0-24, 25-44). */
  glowBoost: boolean;
}

interface BandDef {
  min: number;
  color: string;
  lightColor: string;
  textClass: string;
  borderClass: string;
  glowBoost: boolean;
}

const BANDS: readonly BandDef[] = [
  {
    min: 80,
    color: "#00e5a8",
    lightColor: "#4df0c4",
    textClass: "text-[#00e5a8]",
    borderClass: "border-[#00e5a8]",
    glowBoost: false,
  },
  {
    min: 65,
    color: "#3ee97d",
    lightColor: "#6ff0a0",
    textClass: "text-[#3ee97d]",
    borderClass: "border-[#3ee97d]",
    glowBoost: false,
  },
  {
    min: 45,
    color: "#ffcf5a",
    lightColor: "#ffdd85",
    textClass: "text-[#ffcf5a]",
    borderClass: "border-[#ffcf5a]",
    glowBoost: false,
  },
  {
    min: 25,
    color: "#ff9f43",
    lightColor: "#ffb970",
    textClass: "text-[#ff9f43]",
    borderClass: "border-[#ff9f43]",
    glowBoost: true,
  },
  {
    min: 0,
    color: "#ff3b3b",
    lightColor: "#ff6f6f",
    textClass: "text-[#ff3b3b]",
    borderClass: "border-[#ff3b3b]",
    glowBoost: true,
  },
];

const FALLBACK_BAND = BANDS[BANDS.length - 1];

/** Skor (0-100) → 5-bant renk seti. Aralık dışı değerler en yakın uç banda clamp edilir. */
export function getScoreColor(score: number): ScoreColorBand {
  const band = BANDS.find((b) => score >= b.min) ?? FALLBACK_BAND;
  const { min: _min, ...rest } = band;
  return rest;
}
