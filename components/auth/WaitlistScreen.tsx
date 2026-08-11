"use client";

/**
 * WAITLIST SCREEN — kapalı beta'ya giriş kapısı, premium/mobil-öncelikli.
 *
 * app/api/waitlist/register'a POST atar — gerçek Supabase `waitlist`
 * tablosuna kaydeder, sıra numarası (position) gerçek DB id'sidir (mock
 * değil). `/` (app/page.tsx) ve `/invite/[code]` (app/invite/[code]/page.tsx)
 * tarafından mount ediliyor — ikincisi `referredBy` prop'unu geçerek
 * referral zincirini gerçek kılıyor (bkz. app/api/waitlist/register'daki
 * maybeAutoApproveReferrer — 3 davette otomatik onay).
 */

import { useState } from "react";
import Link from "next/link";
import { QuantixLogo } from "@/components/brand/QuantixLogo";

type WaitlistState = "initial" | "joined";

interface JoinedInfo {
  position: number;
  referralCode: string;
}

interface Props {
  /** /invite/[code]'den gelir — kayıt olurken waitlist.referred_by'a yazılır. */
  referredBy?: string;
}

export function WaitlistScreen({ referredBy }: Props): React.ReactElement {
  const [state, setState] = useState<WaitlistState>("initial");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joined, setJoined] = useState<JoinedInfo | null>(null);

  const referralLink = joined ? `quantixos.com/invite/${joined.referralCode}` : "";

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), referredBy }),
      });
      const data = (await res.json()) as {
        position?: number;
        referralCode?: string;
        error?: string;
      };
      if (!res.ok || !data.position || !data.referralCode) {
        throw new Error(data.error ?? "Registration failed. Please try again.");
      }
      setJoined({ position: data.position, referralCode: data.referralCode });
      setState("joined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(`https://${referralLink}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore — clipboard API kullanılamıyor olabilir */
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0D0E12] px-6 py-12 text-white">
      {/* Subtle glowing gradient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 50% 15%, rgba(16,185,129,0.25), transparent 60%), radial-gradient(circle at 85% 85%, rgba(0,240,255,0.12), transparent 55%)",
        }}
      />

      {/* Scrolling status strip — TickerTape ile aynı ticker-scroll keyframe'i */}
      <div className="absolute top-0 left-0 w-full overflow-hidden border-b border-white/10 bg-[#161820]/80 py-1.5">
        <div className="flex w-max animate-[ticker-scroll_18s_linear_infinite] gap-16 whitespace-nowrap will-change-transform">
          {Array.from({ length: 2 }).map((_, i) => (
            <span
              key={i}
              className="pr-16 font-mono text-[10px] tracking-widest text-[#10B981]"
            >
              🟢 CLOSED BETA ACTIVE — STATUS: NORMAL
            </span>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8 pt-10">
        <div
          className="rounded-full p-1"
          style={{ boxShadow: "0 0 40px rgba(16,185,129,0.35)" }}
        >
          <QuantixLogo size="lg" blend />
        </div>

        {state === "initial" ? (
          <div className="flex w-full flex-col items-center gap-6 text-center">
            <div className="flex flex-col gap-2">
              <h1 className="font-mono text-xl font-bold tracking-tight text-white">
                QUANTIX OS
              </h1>
              <p className="text-sm font-medium tracking-wide text-[#10B981]">
                Global Macro &amp; Algorithmic Terminal
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Access is granted sequentially to ensure system stability and
                execution quality for every trader on the platform.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/10 bg-[#161820] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-[#10B981]/60"
              />
              {error && <p className="text-left text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#10B981] px-4 py-3 text-sm font-bold tracking-wide text-[#0D0E12] transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Joining…" : "Join Waitlist 🚀"}
              </button>
            </form>

            <Link
              href="/sign-in"
              className="text-xs font-medium text-gray-500 underline-offset-4 transition-colors hover:text-[#00F0FF] hover:underline"
            >
              Already have an invite code? Login
            </Link>
          </div>
        ) : joined === null ? null : (
          <div className="flex w-full animate-[waitlist-fade-in_0.4s_ease-out] flex-col items-center gap-6 text-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium tracking-widest text-gray-500 uppercase">
                You&apos;re on the list
              </span>
              <span
                className="font-mono text-4xl font-black text-[#10B981]"
                style={{ textShadow: "0 0 20px rgba(16,185,129,0.5)" }}
              >
                #{joined.position.toLocaleString("en-US")}
              </span>
            </div>

            <div className="w-full rounded-lg border border-white/10 bg-[#161820] p-4">
              <p className="mb-3 text-xs leading-relaxed text-gray-400">
                Invite 3 friends to skip the queue and get instant access!
              </p>
              <div className="flex items-center gap-2 rounded-md border border-white/10 bg-[#0D0E12] px-3 py-2">
                <span className="flex-1 truncate text-left font-mono text-xs text-[#00F0FF]">
                  {referralLink}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 rounded bg-white/5 px-2 py-1 text-[10px] font-bold tracking-wide text-white transition-colors hover:bg-white/10"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="w-full rounded-lg border border-white/10 bg-[#161820] p-4">
              <p className="mb-1 text-sm font-bold text-white">
                Join our Telegram community
              </p>
              <p className="mb-3 text-xs leading-relaxed text-gray-400">
                Get real-time updates on the closed beta rollout and signal
                performance in our Telegram channel.
              </p>
              <a
                href="https://t.me/quantixos_signals"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg bg-[#10B981] px-4 py-3 text-center text-sm font-bold tracking-wide text-[#0D0E12] transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Join Telegram Channel
              </a>
            </div>

            <Link
              href="/sign-in"
              className="text-xs font-medium text-gray-500 underline-offset-4 transition-colors hover:text-[#00F0FF] hover:underline"
            >
              Already have an invite code? Login
            </Link>
          </div>
        )}
      </div>

      <p className="relative z-10 mt-10 max-w-xs text-center text-[10px] leading-relaxed text-gray-600">
        QUANTIX OS is a software tool providing technical indicators and
        signal automation. It does not offer financial or investment advice.
        Algorithmic trading involves risk, including the risk of loss.
      </p>
    </div>
  );
}
