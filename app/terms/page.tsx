import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kullanım Koşulları — QUANTIX OS",
  description: "QUANTIX OS uygulaması kullanım koşulları ve risk bildirimi.",
};

const LAST_UPDATED = "9 Haziran 2026";
const CONTACT_EMAIL = "uguroezdemir34@gmail.com";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E7EB] font-mono">
      <div className="mx-auto max-w-2xl px-5 py-10">

        {/* Header */}
        <div className="mb-8 border-b border-white/10 pb-6">
          <div className="mb-1 text-[10px] tracking-[0.3em] text-[#6B7280] uppercase">
            QUANTIX OS
          </div>
          <h1 className="text-xl font-bold tracking-wide text-white">
            Kullanım Koşulları
          </h1>
          <p className="mt-1 text-xs text-[#6B7280]">
            Terms of Service · Son güncelleme: {LAST_UPDATED}
          </p>
        </div>

        {/* Risk Warning Banner */}
        <div className="mb-8 rounded border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-xs font-bold text-red-400 tracking-wider uppercase mb-1">
            ⚠ Risk Uyarısı / Risk Warning
          </p>
          <p className="text-xs text-[#FCA5A5] leading-relaxed">
            Kripto para vadeli işlemleri yüksek risk içerir. Yatırımınızın tamamını
            kaybedebilirsiniz. Bu uygulama yatırım tavsiyesi vermez.{" "}
            <strong>Yalnızca kaybetmeyi göze aldığınız sermayeyle işlem yapın.</strong>
          </p>
          <p className="mt-2 text-xs text-[#9CA3AF]">
            Cryptocurrency futures trading involves substantial risk of loss. You may lose
            all of your investment. This application does not provide investment advice.
            Only trade with capital you can afford to lose.
          </p>
        </div>

        <div className="space-y-7 text-sm leading-relaxed text-[#D1D5DB]">

          <Section title="1. Kabul">
            <p>
              Bu uygulamayı kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız.
              Koşulları kabul etmiyorsanız uygulamayı kullanmayın.
            </p>
          </Section>

          <Section title="2. Uygulamanın Niteliği">
            <p>
              QUANTIX OS, kripto vadeli işlem takibi ve sinyal üretimi için tasarlanmış
              bir <strong className="text-white">kişisel yardımcı araçtır</strong>.
              Uygulama:
            </p>
            <ul className="mt-2 space-y-1 pl-3 text-[#9CA3AF]">
              <li>· Lisanslı bir finansal aracı kurum değildir</li>
              <li>· Yatırım, vergi veya hukuki danışmanlık sunmaz</li>
              <li>· Algoritmik sinyaller bilgi amaçlıdır, emir garantisi değildir</li>
              <li>· Geçmiş performans gelecekteki sonuçları garanti etmez</li>
            </ul>
            <p className="mt-3">
              <strong className="text-white">Non-custodial:</strong> QUANTIX hiçbir zaman
              paranızı veya varlıklarınızı tutmaz, bir borsa hesabı bağlantısı istemez.
            </p>
          </Section>

          <Section title="3. Kullanıcı Sorumlulukları">
            <ul className="space-y-1 pl-3 text-[#9CA3AF]">
              <li>· OKX API anahtarlarınızı güvende tutmak sizin sorumluluğunuzdadır</li>
              <li>· Açık pozisyonları izlemek kullanıcının sorumluluğundadır</li>
              <li>· OKX platformunun kendi kullanım koşullarına uymak zorunludur</li>
              <li>· Uygulamanın ürettiği algoritmik sinyaller dahil tüm işlem kararları size aittir</li>
              <li>· Risk parametrelerini kendi koşullarınıza göre ayarlamak sizin görevinizdir</li>
            </ul>
          </Section>

          <Section title="4. Sorumluluk Reddi">
            <p>
              Uygulama, yazılım hataları, API kesintileri, piyasa koşulları veya
              kullanıcı hatası nedeniyle oluşabilecek doğrudan, dolaylı veya arızi
              zararlardan sorumlu tutulamaz.
            </p>
            <p className="mt-2 text-[#9CA3AF]">
              The developer is not liable for any direct, indirect, or consequential losses
              arising from use of this application, including but not limited to trading
              losses, missed signals, technical failures, or exchange API outages.
            </p>
          </Section>

          <Section title="5. Abonelik ve Ödeme">
            <ul className="space-y-1 pl-3 text-[#9CA3AF]">
              <li>· Pro abonelik aylık/yıllık olarak Stripe üzerinden alınır</li>
              <li>· İptal halinde dönem sonuna kadar Pro özelliklerine erişim devam eder</li>
              <li>· İade politikası: satın alma tarihinden itibaren 7 gün içinde talep edilebilir</li>
              <li>· İade talepleri için: <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#60A5FA] underline">{CONTACT_EMAIL}</a></li>
            </ul>
          </Section>

          <Section title="6. Hesap ve Güvenlik">
            <p>
              Hesap erişimi Clerk kimlik doğrulama altyapısı üzerinden sağlanır.
              Hesabınızı başkasıyla paylaşmayınız. Yetkisiz erişim tespit edilmesi
              durumunda hesabınız askıya alınabilir.
            </p>
          </Section>

          <Section title="7. Fikri Mülkiyet">
            <p>
              QUANTIX OS adı, logosu, algoritmaları ve arayüz tasarımı Ugur Ozdemir'e
              aittir. İzinsiz kopyalama, dağıtım veya tersine mühendislik yasaktır.
            </p>
          </Section>

          <Section title="8. Değişiklikler ve Fesih">
            <p>
              Geliştirici, koşulları önceden bildirim yapmaksızın değiştirme veya
              hizmetleri durdurma hakkını saklı tutar. Önemli değişikliklerde
              e-posta bildirimi yapılacaktır.
            </p>
          </Section>

          <Section title="9. Uygulanacak Hukuk">
            <p>
              Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklar
              İstanbul mahkemelerinde çözülür.
            </p>
          </Section>

          <Section title="10. İletişim">
            <p>
              Sorular ve geri bildirim için:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#60A5FA] underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-[#4B5563]">
          <p>© 2026 QUANTIX OS — Ugur Ozdemir</p>
          <div className="mt-2 flex justify-center gap-4">
            <Link href="/privacy" className="hover:text-[#9CA3AF] transition-colors">Gizlilik Politikası</Link>
            <Link href="/" className="hover:text-[#9CA3AF] transition-colors">Uygulamaya Dön</Link>
          </div>
        </div>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold tracking-widest text-[#9CA3AF] uppercase border-b border-white/10 pb-1">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
