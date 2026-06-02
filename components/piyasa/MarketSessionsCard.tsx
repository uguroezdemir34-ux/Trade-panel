"use client";

/**
 * MARKET SESSIONS CARD — Shows which major crypto/FX market sessions are active.
 *
 * Sessions (UTC):
 *   Asian:    00:00 – 09:00  (Tokyo 00-06, Hong Kong 01-09)
 *   European: 07:00 – 16:00  (Frankfurt 07-15, London 08-16)
 *   US:       13:00 – 22:00  (New York 13-22)
 *
 * Overlaps (high liquidity):
 *   Asia/EU: 07:00 – 09:00
 *   EU/US:   13:00 – 16:00
 *
 * Updates every minute via useEffect.
 */

import { useState, useEffect } from "react";

interface Session {
  name: string;
  startUtc: number;
  endUtc: number;
  color: string;
  cities: string;
}

const SESSIONS: Session[] = [
  { name: "Asian",    startUtc: 0,  endUtc: 9,  color: "#f59e0b", cities: "Tokyo · HK" },
  { name: "European", startUtc: 7,  endUtc: 16, color: "#60a5fa", cities: "Frankfurt · London" },
  { name: "US",       startUtc: 13, endUtc: 22, color: "#22c55e", cities: "New York" },
];

function getUtcHour(): number {
  return new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
}

function isActive(session: Session, utcHour: number): boolean {
  return utcHour >= session.startUtc && utcHour < session.endUtc;
}

function timeUntilChange(session: Session, utcHour: number, active: boolean): string {
  const boundary = active ? session.endUtc : session.startUtc;
  let diff = boundary - utcHour;
  if (diff < 0) diff += 24;
  const h = Math.floor(diff);
  const m = Math.round((diff - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function utcTimeStr(): string {
  const now = new Date();
  const h = now.getUTCHours().toString().padStart(2, "0");
  const m = now.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m} UTC`;
}

export function MarketSessionsCard(): React.ReactElement {
  const [utcHour, setUtcHour] = useState(() => getUtcHour());
  const [utcStr, setUtcStr] = useState(() => utcTimeStr());

  useEffect(() => {
    const update = () => {
      setUtcHour(getUtcHour());
      setUtcStr(utcTimeStr());
    };
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  const activeSessions = SESSIONS.filter((s) => isActive(s, utcHour));
  const overlapCount = activeSessions.length;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          🕐 Market Sessions
        </h3>
        <span className="text-text-t4 font-mono text-2xs tabular-nums">{utcStr}</span>
      </div>

      {overlapCount >= 2 && (
        <div className="mb-2 flex items-center gap-1.5 rounded bg-brand/10 border border-brand/20 px-2 py-1">
          <span className="text-brand font-mono text-2xs font-semibold">
            ⚡ Session Overlap
          </span>
          <span className="text-text-t4 font-mono text-2xs">
            — higher liquidity &amp; volatility
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {SESSIONS.map((session) => {
          const active = isActive(session, utcHour);
          const until = timeUntilChange(session, utcHour, active);
          const barWidth = ((session.endUtc - session.startUtc) / 24) * 100;
          const barLeft = (session.startUtc / 24) * 100;

          return (
            <div key={session.name} className="flex flex-col gap-0.5">
              {/* Line 1: dot + name + badge */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{
                      background: active ? session.color : "transparent",
                      border: `1.5px solid ${active ? session.color : "var(--color-border)"}`,
                    }}
                  />
                  <span
                    className="font-mono text-xs font-semibold"
                    style={{ color: active ? session.color : "var(--color-text-t3)" }}
                  >
                    {session.name}
                  </span>
                </div>
                <span
                  className="font-mono text-2xs font-bold rounded px-1.5 py-0.5 shrink-0"
                  style={{
                    background: active ? `${session.color}20` : "transparent",
                    color: active ? session.color : "var(--color-text-t4)",
                    border: `1px solid ${active ? `${session.color}40` : "var(--color-border)"}`,
                  }}
                >
                  {active ? "OPEN" : "CLOSED"}
                </span>
              </div>
              {/* Line 2: cities + timing */}
              <div className="pl-3.5 text-text-t4 font-mono text-2xs">
                {session.cities} · {active ? `closes in ${until}` : `opens in ${until}`}
              </div>
              {/* Timeline bar */}
              <div className="relative h-1.5 w-full rounded-full bg-border/30 overflow-hidden">
                <div
                  className="absolute top-0 h-full rounded-full"
                  style={{
                    left: `${barLeft}%`,
                    width: `${barWidth}%`,
                    background: active ? session.color : `${session.color}40`,
                  }}
                />
                <div
                  className="absolute top-0 h-full w-0.5 bg-white/60 rounded-full"
                  style={{ left: `${(utcHour / 24) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-text-t4 font-mono text-2xs flex justify-between">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}
