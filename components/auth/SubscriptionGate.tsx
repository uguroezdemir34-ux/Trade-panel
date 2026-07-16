"use client";

/**
 * SUBSCRIPTION GATE — Adım 4.1 (Kapalı Beta Kapısı).
 *
 * ÖNCEDEN: koşulsuz no-op — `feature` prop'unu hiç okumuyordu, her zaman
 * `children`'ı render ediyordu (bkz. Adım 4 araştırma raporu — bu, TÜM
 * kart/özellik kısıtlamalarının o zamana kadar dekoratif kaldığı anlamına
 * geliyordu).
 *
 * ŞİMDİ: kullanıcının publicMetadata'sını okuyup erişimi gerçekten
 * kısıtlıyor. Erişim kuralı — betaAccess===true VEYA plan pro/enterprise
 * (ikisinden biri yeterli — halihazırda ödeme yapan pro/enterprise
 * kullanıcıların AYRICA elle betaAccess flag'i almasına gerek kalmasın diye):
 *
 *   allowed = publicMetadata.betaAccess === true
 *          || publicMetadata.plan === "pro"
 *          || publicMetadata.plan === "enterprise"
 *
 * Clerk hiç yapılandırılmamışsa (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY yok —
 * "tek kullanıcı modu") kısıtlama uygulanmaz, `children` render edilir —
 * bu, dosyanın önceki no-op yorumunun koruduğu davranış, bilerek korunuyor
 * (yerel/Clerk'siz geliştirmeyi kilitlemesin diye).
 *
 * `feature` prop'u bilerek bu turda KULLANILMADI — kapsam sadece beta/plan
 * kapısı, ince-taneli özellik bazlı kısıtlama (hasFeature()) ayrı bir tur.
 */

import { useUserStub } from "@/lib/auth/stubs";
import { getPlanTier, type ClerkUserLike, type FeatureKey } from "@/lib/auth/subscription";

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

interface Props {
  feature: FeatureKey;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

function isBetaAllowed(user: ClerkUserLike | null): boolean {
  if (user?.publicMetadata?.betaAccess === true) return true;
  const tier = getPlanTier(user);
  return tier === "pro" || tier === "enterprise";
}

export function SubscriptionGate({ fallback, children }: Props): React.ReactElement | null {
  const { user, isLoaded } = useUserStub();

  // Clerk yapılandırılmamış — tek kullanıcı modu, kısıtlama yok.
  if (!CLERK_KEY) return <>{children}</>;

  // Clerk henüz resolve olmadı — yanlış (kilitli/açık) durumu flashlamamak
  // için hiçbir şey render etme.
  if (!isLoaded) return null;

  if (isBetaAllowed(user)) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return <BetaAccessRequiredCard />;
}

function BetaAccessRequiredCard(): React.ReactElement {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-950/10 p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl">🔒</span>
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400">
            Kapalı Beta Erişimi Gerekli
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-text-t3">
            Bu özellik şu an sadece kapalı beta grubu üyelerine veya Pro/Enterprise
            abonelerine açık.
          </p>
        </div>
      </div>
    </div>
  );
}
