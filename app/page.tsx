import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/serverStubs";
import { WaitlistScreen } from "@/components/auth/WaitlistScreen";
import { BRAND_META } from "@/lib/brand";

// Dijital denetim raporu (§7 madde 5, düşük öncelik) bulgusu: hiç
// yapılandırılmış veri (Schema.org/JSON-LD) yoktu. name/description
// BRAND_META ile birebir aynı — layout.tsx'teki <title>/<meta description>
// zaten onaylanmış metnin tekrarı, yeni bir iddia icat edilmedi.
// Fabrikasyon YOK: fiyat/puan/yorum sayısı gibi elde doğrulanmış bir
// değer olmayan alanlar (offers, aggregateRating) BİLEREK eklenmedi.
const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: BRAND_META.title,
  description: BRAND_META.description,
  applicationCategory: "FinanceApplication",
  // Capacitor iOS/Android sarmalayıcısı kodda var ama YAYINDA DEĞİL —
  // doğrulandı: .github/workflows/android-release-aab.yml "TASLAK, henüz
  // aktif değil" diyor, docs/play-store-checklist.md'de Play Console
  // hesabı bile açılmamış (ilk madde işaretsiz), iOS için hiç release
  // workflow'u yok. Sadece fiilen canlı olan kanal iddia ediliyor.
  operatingSystem: "Web",
  url: "https://quantixos.com",
};

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
  // middleware.ts'in ürettiği aynı nonce (x-nonce request header'ı) —
  // CSP script-src bunu ZORUNLU kılıyor (application/ld+json dahil TÜM
  // <script> elementleri, type'a bakılmaksızın) — nonce'suz bırakılsaydı
  // CSP report-only'den enforce'a geçtiğinde bu blok sessizce bloklanırdı.
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD) }}
      />
      <WaitlistScreen />
    </>
  );
}
