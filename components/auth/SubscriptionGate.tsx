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

/**
 * Clerk frontend API'sinden gelen publicMetadata'da betaAccess bazı
 * durumlarda boolean `true` yerine string `"true"`/`"1"` olarak
 * saklanmış/dönmüş olabilir (Dashboard'dan elle JSON girişi, ya da
 * SDK/serileştirme farkı) — tip toleranslı okunuyor, middleware.ts'teki
 * isTruthyFlag() ile aynı mantık.
 */
function isTruthyFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

/**
 * user/publicMetadata okurken TAMAMEN optional-chaining güvenli — `user`
 * null/undefined olabilir, `publicMetadata` olmayabilir, `betaAccess`/`plan`
 * hiç set edilmemiş olabilir. Hiçbiri throw etmez, hepsi `undefined`'a düşer.
 */
function isBetaAllowed(user: ClerkUserLike | null | undefined): boolean {
  if (isTruthyFlag(user?.publicMetadata?.betaAccess)) return true;
  const tier = getPlanTier(user);
  return tier === "pro" || tier === "enterprise";
}

export function SubscriptionGate({ fallback, children }: Props): React.ReactElement | null {
  const { user, isLoaded } = useUserStub();

  // Clerk yapılandırılmamış (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY yok) — tek
  // kullanıcı modu, kısıtlama BYPASS edilir, children koşulsuz render edilir.
  if (!CLERK_KEY) return <>{children}</>;

  // Clerk henüz resolve olmadı — yanlış (kilitli/açık) durumu flashlamamak
  // için hiçbir şey render etme.
  if (!isLoaded) return null;

  // [BETA-DEBUG] GEÇİCİ — betaAccess neden tanınmıyor sorununu teşhis
  // etmek için eklendi, kaynak teşhis edildikten sonra kaldırılacak.
  // Bu loglar TARAYICI DevTools konsolunda görünür (client component) —
  // middleware.ts'teki [BETA-DEBUG] loglarından FARKLI bir yerde: bu
  // dosya Clerk'in canlı frontend API'sinden `useUser()` ile okuyor,
  // session token/JWT claim'ine bağlı değil.
  console.log("[BETA-DEBUG][SubscriptionGate] user:", user);
  console.log("[BETA-DEBUG][SubscriptionGate] user?.publicMetadata:", user?.publicMetadata);
  console.log(
    "[BETA-DEBUG][SubscriptionGate] betaAccess raw value:",
    user?.publicMetadata?.betaAccess,
    "| typeof:",
    typeof user?.publicMetadata?.betaAccess
  );

  // Ekstra güvenlik ağı: user/publicMetadata okuması zaten optional-chaining
  // ile güvenli, ama beklenmedik bir Clerk SDK hatası (örn. bozuk/eksik
  // metadata şekli) burada yakalanır — throw client tree'yi (ve dolayısıyla
  // TÜM sayfa içeriğini) çökertip beyaz ekrana düşürmez. Hata durumunda
  // güvenli varsayılan: erişim YOK (kilitli kart) — sessizce bypass etmek
  // (children göstermek) yanlış tarafa hata yapardı.
  try {
    if (isBetaAllowed(user)) return <>{children}</>;
  } catch (err) {
    console.error("[SubscriptionGate] beta erişim kontrolü başarısız, güvenli varsayılana düşülüyor:", err);
  }

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
