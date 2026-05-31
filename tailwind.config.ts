import type { Config } from "tailwindcss";

/**
 * v55.51 panel CSS değişkenlerinden birebir port edildi.
 * Renkler değiştirilmemeli — UI tutarlılığı + alışılmış görsel kimlik.
 * Kaynak: panel_v55_51.html satır 622-642.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "rgb(var(--bg) / <alpha-value>)",
          card: "rgb(var(--bg-card) / <alpha-value>)",
          card2: "rgb(var(--bg-card2) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          strong: "rgb(var(--border-strong) / <alpha-value>)",
        },
        text: {
          t1: "rgb(var(--text-t1) / <alpha-value>)",
          t2: "rgb(var(--text-t2) / <alpha-value>)",
          t3: "rgb(var(--text-t3) / <alpha-value>)",
          t4: "rgb(var(--text-t4) / <alpha-value>)",
        },
        // Marka turuncu — Uğur Panel kimliği (OKX yeşili DEĞİL)
        brand: {
          DEFAULT: "#FF6B1A",
          light: "#FF8C42",
        },
        signal: {
          green: "#22C55E",
          red: "#EF4444",
          amber: "#F59E0B",
          blue: "#3B82F6",
        },
        soft: {
          green: "rgba(34,197,94,0.08)",
          red: "rgba(239,68,68,0.08)",
          amber: "rgba(245,158,11,0.08)",
          blue: "rgba(59,130,246,0.08)",
        },
        // Surface layers — card elevations (theme-aware via CSS vars)
        surface: {
          s1: "rgb(var(--surface-s1) / <alpha-value>)",
          s2: "rgb(var(--surface-s2) / <alpha-value>)",
          s3: "rgb(var(--surface-s3) / <alpha-value>)",
        },
        // Warning (amber alias)
        warning: "#F59E0B",
        // Text on colored backgrounds (matches bg color for contrast)
        "bg-page": "rgb(var(--bg) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          '"IBM Plex Sans"',
          '"Noto Sans SC"',
          '"Noto Sans JP"',
          '"Noto Sans KR"',
          '"Noto Sans Arabic"',
          '"Noto Sans Devanagari"',
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"IBM Plex Mono"',
          '"Noto Sans SC"',
          '"Noto Sans JP"',
          '"Noto Sans KR"',
          '"Noto Sans Arabic"',
          '"Noto Sans Devanagari"',
          "ui-monospace",
          "monospace",
        ],
      },
      fontSize: {
        base: ["14px", "1.5"],
        xs: ["11px", "1.4"],
        "2xs": ["9px", "1.3"],
      },
      letterSpacing: {
        wider: "0.05em",
        widest: "0.08em",
      },
    },
  },
  plugins: [],
};

export default config;
