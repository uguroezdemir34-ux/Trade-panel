import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/serverStubs";
import { WaitlistScreen } from "@/components/auth/WaitlistScreen";

/**
 * Root sayfa.
 *
 * Giriş yapmış (Clerk session'ı olan) kullanıcı → /karar'a redirect
 * (eski davranış, korunuyor — beta/plan kontrolü zaten middleware.ts'in
 * isBetaGatedRoute mantığında ayrıca yapılıyor, burada tekrarlanmıyor).
 *
 * Giriş yapmamış ziyaretçi → redirect YOK, doğrudan <WaitlistScreen/>
 * render edilir. "/" zaten middleware.ts'in isPublicRoute listesinde —
 * Clerk session'ı olmadan da serbestçe erişilebiliyor, bu yüzden burada
 * ekstra bir middleware değişikliği gerekmedi.
 */
export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/karar");
  }
  return <WaitlistScreen />;
}
