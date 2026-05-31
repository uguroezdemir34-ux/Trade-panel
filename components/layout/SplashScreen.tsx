"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { QuantixLogo } from "@/components/brand/QuantixLogo";
import { useT } from "@/lib/i18n/context";

interface Props {
  onDone: () => void;
}

type Phase = "enter" | "active" | "exit";

// Total visible time after enter animations settle
const ACTIVE_MS = 2000;
const EXIT_MS   = 600;

// ── Web Audio: premium startup chime ─────────────────────────────
function playChime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.14, ctx.currentTime);
    master.connect(ctx.destination);

    // Sweep: high → low (power-on feel)
    const sweep     = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.type = "sine";
    sweep.frequency.setValueAtTime(1200, ctx.currentTime);
    sweep.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
    sweepGain.gain.setValueAtTime(0.5, ctx.currentTime);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    sweep.connect(sweepGain);
    sweepGain.connect(master);
    sweep.start(ctx.currentTime);
    sweep.stop(ctx.currentTime + 0.45);

    // A-major chord — A4 C#5 E5, staggered for prestige feel
    const chord = [440, 554.37, 659.26];
    chord.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0   = ctx.currentTime + 0.18 + i * 0.08;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.42, t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.8);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + 0.85);
    });

    setTimeout(() => void ctx.close(), 1500);
  } catch {
    /* autoplay blocked or Web Audio unavailable — silent */
  }
}

// ── Letter-by-letter brand name ───────────────────────────────────
const LETTERS = ["Q", "U", "A", "N", "T", "I", "X"];

export function SplashScreen({ onDone }: Props): React.ReactElement {
  const t = useT();
  const [phase, setPhase]           = useState<Phase>("enter");
  const [skipVisible, setSkipVisible] = useState(false);
  const onDoneRef                   = useRef(onDone);
  onDoneRef.current                 = onDone;

  const triggerExit = useCallback(() => {
    setPhase("exit");
    setTimeout(() => onDoneRef.current(), EXIT_MS);
  }, []);

  useEffect(() => {
    playChime();

    // After all enter animations settle (~1.3s) → active phase + skip
    const t1 = setTimeout(() => {
      setPhase("active");
      setSkipVisible(true);
    }, 1350);

    // Auto-exit after active duration
    const t2 = setTimeout(() => {
      triggerExit();
    }, 1350 + ACTIVE_MS);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [triggerExit]);

  const isExiting = phase === "exit";

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden${isExiting ? " sp-exit" : ""}`}
      style={{ background: "#000000" }}
    >
      {/* Power-on flash overlay */}
      <div
        className="sp-poweron pointer-events-none absolute inset-0"
        style={{ background: "#FFFFFF", zIndex: 1 }}
      />

      {/* Horizontal scan line */}
      <div
        className="sp-scan absolute left-0 right-0 h-[2px] pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent 0%, #FF6B1A 50%, transparent 100%)",
          zIndex: 2,
        }}
      />

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-col items-center">

        {/* Logo with glow ring */}
        <div className="relative flex items-center justify-center">
          {/* Glow ring */}
          <div
            className="sp-ring absolute rounded-full"
            style={{
              width: 148,
              height: 148,
              borderRadius: "50%",
              border: "1.5px solid rgba(255, 107, 26, 0.6)",
            }}
          />
          {/* Logo */}
          <div className="sp-logo">
            <QuantixLogo size="lg" />
          </div>
        </div>

        {/* Brand name — harf harf */}
        <div className="mt-8 flex items-center gap-[2px]">
          {LETTERS.map((letter, i) => (
            <span
              key={letter + i}
              className={`sp-l${i} sp-glow inline-block font-mono text-[32px] font-bold tracking-[0.18em] text-white`}
            >
              {letter}
            </span>
          ))}
          {/* OS badge */}
          <span
            className="sp-badge ml-2.5 self-start mt-1 rounded px-1.5 py-[3px] font-mono text-[10px] font-bold tracking-widest text-white"
            style={{ background: "#FF6B1A" }}
          >
            OS
          </span>
        </div>

        {/* Tagline */}
        <p
          className="sp-tagline mt-2.5 font-mono text-[11px] tracking-[0.16em] uppercase"
          style={{ color: "#4A4A4A" }}
        >
          {t("app.tagline")}
        </p>

        {/* Progress bar */}
        <div
          className="mt-10 h-[1px] w-32 overflow-hidden"
          style={{ background: "#1A1A1A" }}
        >
          <div
            className="sp-bar h-full"
            style={{ background: "linear-gradient(90deg, #FF6B1A, #FFB300)" }}
          />
        </div>
      </div>

      {/* Skip button — bottom right */}
      {skipVisible && !isExiting && (
        <button
          type="button"
          onClick={triggerExit}
          className="absolute bottom-8 right-6 font-mono text-[10px] tracking-[0.2em] uppercase transition-opacity duration-200 hover:opacity-100"
          style={{
            color: "#3A3A3A",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            opacity: 0.55,
            padding: "8px 12px",
          }}
        >
          SKIP ›
        </button>
      )}
    </div>
  );
}
