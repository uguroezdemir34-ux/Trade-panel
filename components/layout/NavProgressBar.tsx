"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useNavStore } from "@/lib/store/navStore";

type Phase = "idle" | "enter" | "run" | "done";

export function NavProgressBar(): React.ReactElement | null {
  const pending = useNavStore((s) => s.pending);
  const setPending = useNavStore((s) => s.setPending);
  const pathname = usePathname();
  const [phase, setPhaseState] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");

  function setPhase(p: Phase): void {
    phaseRef.current = p;
    setPhaseState(p);
  }

  // pathname değişince navigasyon tamamlandı — pending'i kapat
  useEffect(() => {
    setPending(false);
  }, [pathname, setPending]);

  useEffect(() => {
    if (!pending) {
      if (phaseRef.current === "run" || phaseRef.current === "enter") {
        setPhase("done");
        const t = setTimeout(() => setPhase("idle"), 500);
        return () => clearTimeout(t);
      }
      return;
    }

    // 100ms delay: hızlı (cache hit) geçişlerde bar hiç görünmez
    let t2: ReturnType<typeof setTimeout>;
    const t1 = setTimeout(() => {
      setPhase("enter");
      t2 = setTimeout(() => setPhase("run"), 16);
    }, 100);

    return () => {
      clearTimeout(t1);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (t2) clearTimeout(t2);
    };
  }, [pending]);

  if (phase === "idle") return null;

  return (
    <div aria-hidden className="pointer-events-none fixed top-0 left-0 right-0 z-[9999] h-[2px]">
      <div
        className="h-full bg-brand"
        style={{
          transition:
            phase === "run"
              ? "width 3500ms ease-out"
              : phase === "done"
                ? "width 250ms ease-out, opacity 400ms ease-in"
                : "none",
          width: phase === "enter" ? "0%" : phase === "run" ? "82%" : "100%",
          opacity: phase === "done" ? 0 : 1,
        }}
      />
    </div>
  );
}
