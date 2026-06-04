"use client";

/**
 * AUDIO ALERTS — Browser Web Audio API beep.
 *
 * No external files needed — generates tones synthetically.
 *
 * playGoAlert()       — short rising 2-tone beep (GO signal)
 * playMomentumAlert() — single mid-tone beep (score momentum)
 * playPriceAlert()    — short flat beep (price alarm)
 */

type AudioCtxType = typeof AudioContext;

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const Cls = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtxType }).webkitAudioContext) as AudioCtxType | undefined;
      if (Cls) ctx = new Cls();
    } catch {
      return null;
    }
  }
  return ctx;
}

function beep(
  freq: number,
  duration: number,
  volume: number,
  startOffset: number,
  context: AudioContext,
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.connect(gain);
  gain.connect(context.destination);
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.setValueAtTime(0, context.currentTime + startOffset);
  gain.gain.linearRampToValueAtTime(volume, context.currentTime + startOffset + 0.01);
  gain.gain.linearRampToValueAtTime(0, context.currentTime + startOffset + duration);
  osc.start(context.currentTime + startOffset);
  osc.stop(context.currentTime + startOffset + duration + 0.05);
}

/** GO signal — two ascending tones: 880 Hz then 1100 Hz */
export function playGoAlert(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  beep(880,  0.12, 0.25, 0,    c);
  beep(1100, 0.18, 0.20, 0.14, c);
}

/** Score momentum approaching GO — single mid tone */
export function playMomentumAlert(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  beep(660, 0.15, 0.18, 0, c);
}

/** Price alarm triggered — two short identical tones */
export function playPriceAlert(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  beep(750, 0.10, 0.20, 0,    c);
  beep(750, 0.10, 0.18, 0.15, c);
}
