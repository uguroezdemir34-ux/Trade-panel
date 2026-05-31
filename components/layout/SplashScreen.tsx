"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { QuantixLogo } from "@/components/brand/QuantixLogo";
import { useT } from "@/lib/i18n/context";

interface Props {
  onDone: () => void;
}

type Phase = "enter" | "active" | "exit";

const ENTER_DURATION  = 700;   // enter animations settle
const ACTIVE_DURATION = 1600;  // active display (bar fills in 1600ms)
const EXIT_DURATION   = 550;   // fade-out

function playStartupChime(): void {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.18, ctx.currentTime);
    master.connect(ctx.destination);

    // Sweep: 880 → 440 Hz over 400ms
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.type = "sine";
    sweep.frequency.setValueAtTime(880, ctx.currentTime);
    sweep.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);
    sweepGain.gain.setValueAtTime(0.6, ctx.currentTime);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    sweep.connect(sweepGain);
    sweepGain.connect(master);
    sweep.start(ctx.currentTime);
    sweep.stop(ctx.currentTime + 0.5);

    // A-major chord: A4 (440) + C#5 (554) + E5 (659), staggered
    const chord = [440, 554.37, 659.26];
    chord.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = ctx.currentTime + 0.12 + i * 0.07;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.45, t0 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + 0.75);
    });

    // Auto-close context after all sounds finish
    setTimeout(() => { void ctx.close(); }, 1200);
  } catch {
    // Browser blocked autoplay or Web Audio unavailable — fail silently
  }
}

export function SplashScreen({ onDone }: Props): React.ReactElement {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("enter");
  const [skipVisible, setSkipVisible] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const triggerExit = useCallback(() => {
    setPhase("exit");
    setTimeout(() => onDoneRef.current(), EXIT_DURATION);
  }, []);

  useEffect(() => {
    playStartupChime();

    const t1 = setTimeout(() => {
      setPhase("active");
      setSkipVisible(true);
    }, ENTER_DURATION);

    const t2 = setTimeout(() => {
      triggerExit();
    }, ENTER_DURATION + ACTIVE_DURATION);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [triggerExit]);

  return (
    <div
      aria-hidden="true"
      className={`splash-root fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden${phase === "exit" ? " splash-fade-out" : ""}`}
      style={{ color: "var(--splash-fg)" }}
    >
      {/* Scanline sweep */}
      <div
        className="splash-scanline absolute left-0 right-0 h-[15%]"
        style={{
          background: "linear-gradient(to bottom, transparent, var(--splash-accent), transparent)",
          opacity: 0.06,
        }}
      />

      {/* Logo */}
      <div className="splash-logo relative z-10">
        <QuantixLogo size="lg" />
      </div>

      {/* Brand name + neon glow + OS badge */}
      <div className="splash-name relative z-10 mt-6 flex items-center gap-2.5">
        <span
          className="splash-neon font-mono text-[28px] font-bold tracking-[0.14em]"
          style={{ color: "var(--splash-fg)" }}
        >
          QUANTIX
        </span>
        <span
          className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-white"
          style={{ background: "var(--splash-accent)" }}
        >
          OS
        </span>
      </div>

      {/* Tagline */}
      <p
        className="splash-tagline relative z-10 mt-2 font-mono text-[11px] tracking-[0.12em]"
        style={{ color: "var(--splash-muted)" }}
      >
        {t("app.tagline")}
      </p>

      {/* Progress bar */}
      <div
        className="absolute bottom-16 left-1/2 h-px w-28 -translate-x-1/2 overflow-hidden"
        style={{ background: "var(--splash-border)" }}
      >
        {phase !== "enter" && (
          <div
            className="splash-bar h-full"
            style={{ background: "var(--splash-accent)" }}
          />
        )}
      </div>

      {/* Skip button */}
      {skipVisible && phase !== "exit" && (
        <button
          type="button"
          onClick={triggerExit}
          className="absolute bottom-8 right-6 font-mono text-[11px] tracking-widest transition-opacity"
          style={{
            color: "var(--splash-muted)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            opacity: 0.7,
            padding: "6px 10px",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.7"; }}
        >
          SKIP ›
        </button>
      )}
    </div>
  );
}
