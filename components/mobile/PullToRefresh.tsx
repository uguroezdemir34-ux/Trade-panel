"use client";

/**
 * PULL TO REFRESH — Mobil doğal yenileme hareketi.
 *
 * Dokunma: parmağı aşağı çek → spinner → bırak → onRefresh()
 * Haptic: çekme başlarken light, yenileme tetiklenince medium
 * Masaüstünde: görünmez (touch event yok)
 */

import { useState, useRef, useCallback } from "react";
import { useHaptics } from "@/lib/hooks/useHaptics";

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  threshold?: number; // px kaç çekince tetiklensin (default 72)
  className?: string;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 72,
  className = "",
}: PullToRefreshProps): React.ReactElement {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const haptics = useHaptics();
  const hapticFiredRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Sadece sayfanın tepesindeyken tetikle
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
    hapticFiredRef.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) return;

      // Elastik direnç: gerçek çekiş miktarının kare kökü
      const dist = Math.min(Math.sqrt(dy) * 4, threshold * 1.5);
      setPullDistance(dist);

      // Eşik aşılınca bir kez haptic
      if (dist >= threshold && !hapticFiredRef.current) {
        haptics.medium();
        hapticFiredRef.current = true;
      }
    },
    [refreshing, threshold, haptics],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, refreshing, onRefresh]);

  const pct = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 8 || refreshing;

  return (
    <div
      className={`relative ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => void handleTouchEnd()}
      onTouchCancel={() => {
        pulling.current = false;
        setPullDistance(0);
      }}
    >
      {/* Pull indicator */}
      {showIndicator && (
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center"
          style={{
            top: refreshing ? 8 : Math.max(pullDistance - 36, 0),
            opacity: refreshing ? 1 : pct,
            transition: refreshing ? "none" : "opacity 0.1s",
          }}
        >
          <div
            className={[
              "w-8 h-8 rounded-full border-2 border-brand flex items-center justify-center",
              "bg-surface shadow-lg",
            ].join(" ")}
            style={{
              transform: `rotate(${refreshing ? 0 : pct * 360}deg)`,
              transition: refreshing ? "none" : "transform 0.05s",
            }}
          >
            {refreshing ? (
              <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                className="w-4 h-4 text-brand"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Content — içeriği aşağı it (çekme mesafesi kadar) */}
      <div
        style={{
          transform: `translateY(${refreshing ? 40 : pullDistance}px)`,
          transition: pulling.current ? "none" : "transform 0.25s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
