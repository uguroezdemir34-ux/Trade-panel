import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/serverStubs";
import { WaitlistScreen } from "@/components/auth/WaitlistScreen";

/**
 * /invite/[code] — referral linki (bkz. WaitlistScreen'deki "joined"
 * state'inde gösterilen `quantixos.com/invite/{referralCode}` linki).
 *
 * app/page.tsx ("/") ile birebir aynı auth mantığı — tek fark, WaitlistScreen'e
 * URL'deki kodu `referredBy` olarak geçmesi, böylece kayıt olunca
 * waitlist.referred_by kolonuna yazılır (bkz. app/api/waitlist/register).
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { userId } = await auth();
  if (userId) {
    redirect("/karar");
  }
  const { code } = await params;
  return <WaitlistScreen referredBy={code} />;
}
