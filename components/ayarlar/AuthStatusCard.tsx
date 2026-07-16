"use client";

/**
 * AUTH STATUS CARD — Ayarlar sayfasında Sign In / Sign Out.
 *
 * Clerk yapılandırılmamışsa (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY yok — "tek
 * kullanıcı modu") hiç render edilmez — SubscriptionGate.tsx'teki aynı
 * bypass felsefesi: gitmeyeceği bir yere buton koymamak.
 */

import { useUserStub } from "@/lib/auth/stubs";
import { UserButtonStub } from "@/lib/auth/UserButtonStub";
import { useT } from "@/lib/i18n/context";

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function AuthStatusCard(): React.ReactElement | null {
  const t = useT();
  const { user, isLoaded } = useUserStub();

  if (!CLERK_KEY) return null;
  if (!isLoaded) return null;

  return (
    <div className="border-border bg-bg-card flex items-center justify-between gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-text-t4 font-mono text-xs tracking-wider uppercase">
          {t("auth.accountStatus.title")}
        </p>
        <p className="text-text-t1 font-mono text-xs">
          {user
            ? (user.primaryEmailAddress?.emailAddress ?? t("auth.accountStatus.signedIn"))
            : t("auth.accountStatus.signedOut")}
        </p>
      </div>

      {user ? (
        <UserButtonStub afterSignOutUrl="/" />
      ) : (
        <a
          href="/sign-in"
          className="bg-brand hover:bg-brand/90 shrink-0 rounded px-3 py-2 font-mono text-xs tracking-widest text-white transition-colors"
        >
          {t("auth.accountStatus.signInBtn")}
        </a>
      )}
    </div>
  );
}
