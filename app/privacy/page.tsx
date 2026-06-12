import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik Politikası — QUANTIX OS",
  description: "QUANTIX OS uygulamasının gizlilik politikası ve veri işleme pratikleri.",
};

const LAST_UPDATED = "9 Haziran 2026";
const CONTACT_EMAIL = "uguroezdemir34@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E7EB] font-mono">
      <div className="mx-auto max-w-2xl px-5 py-10">

        {/* Header */}
        <div className="mb-8 border-b border-white/10 pb-6">
          <div className="mb-1 text-[10px] tracking-[0.3em] text-[#6B7280] uppercase">
            QUANTIX OS
          </div>
          <h1 className="text-xl font-bold tracking-wide text-white">
            Gizlilik Politikası
          </h1>
          <p className="mt-1 text-xs text-[#6B7280]">
            Privacy Policy · Son güncelleme: {LAST_UPDATED}
          </p>
        </div>

        {/* EN Summary */}
        <section className="mb-8 rounded border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-xs font-bold tracking-widest text-[#9CA3AF] uppercase">
            Summary (English)
          </h2>
          <ul className="space-y-1 text-xs text-[#9CA3AF]">
            <li>· Your trading data stays on your device (localStorage).</li>
            <li>· API credentials are AES-256-GCM encrypted — never sent to our servers.</li>
            <li>· We do not sell your data to third parties.</li>
            <li>· Push notification tokens are stored securely on our server.</li>
            <li>· Authentication is handled by Clerk. Payments by Stripe.</li>
          </ul>
        </section>

        <div className="space-y-7 text-sm leading-relaxed text-[#D1D5DB]">

          {/* 1 */}
          <Section title="1. Geliştirici Bilgileri">
            <p>
              Bu uygulama <strong className="text-white">Ugur Ozdemir</strong> tarafından
              geliştirilmiş olup bireysel geliştirici statüsünde yayınlanmaktadır.
            </p>
            <p>
              İletişim: <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#60A5FA] underline">{CONTACT_EMAIL}</a>
            </p>
          </Section>

          {/* 2 */}
          <Section title="2. Toplanan Veriler">
            <SubSection title="Cihazda Saklanan (localStorage)">
              <li>Trade geçmişi, pozisyon verileri, skor geçmişi</li>
              <li>Uygulama ayarları (tema, dil, risk limitleri)</li>
              <li>OKX API anahtarları — <strong className="text-white">AES-256-GCM ile şifrelenmiş</strong>, ham haliyle cihazı terk etmez</li>
              <li>Telegram bot token ve chat ID — aynı şekilde şifreli</li>
              <li>Fiyat alarmları ve kişisel notlar</li>
            </SubSection>

            <SubSection title="Sunucularımızda Saklanan">
              <li>Clerk aracılığıyla kimlik doğrulama verisi (e-posta, kullanıcı ID)</li>
              <li>Push bildirim abonelik tokenleri (şifreli)</li>
              <li>Kapatılan trade geçmişi (senkronizasyon için)</li>
            </SubSection>

            <SubSection title="Toplamadığımız Veriler">
              <li>Ham API sırları (Passphrase vb.) — hiçbir zaman sunucuya gönderilmez</li>
              <li>Konum verisi</li>
              <li>Kamera veya mikrofon</li>
              <li>Kişi rehberi</li>
            </SubSection>
          </Section>

          {/* 3 */}
          <Section title="3. Verilerin Kullanımı">
            <p>Toplanan veriler yalnızca şu amaçlarla kullanılır:</p>
            <ul className="mt-2 space-y-1 pl-3">
              <li>· Uygulamanın çalışması ve kişiselleştirilmesi</li>
              <li>· OKX API üzerinden piyasa verileri çekme (proxy)</li>
              <li>· Telegram üzerinden bildirim gönderme (kullanıcı yapılandırırsa)</li>
              <li>· Push bildirimleri (kullanıcı izin verirse)</li>
              <li>· Pro abonelik yönetimi (Stripe)</li>
            </ul>
          </Section>

          {/* 4 */}
          <Section title="4. Üçüncü Taraf Hizmetler">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[#9CA3AF]">
                  <th className="py-1.5 text-left">Hizmet</th>
                  <th className="py-1.5 text-left">Amaç</th>
                  <th className="py-1.5 text-left">Gizlilik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <ThirdPartyRow name="OKX" purpose="Piyasa verisi + emir yönetimi" link="https://www.okx.com/legal/privacy-policy" />
                <ThirdPartyRow name="Telegram" purpose="Ticari bildirimler" link="https://telegram.org/privacy" />
                <ThirdPartyRow name="Clerk" purpose="Kimlik doğrulama" link="https://clerk.com/legal/privacy" />
                <ThirdPartyRow name="Stripe" purpose="Ödeme işlemleri" link="https://stripe.com/privacy" />
                <ThirdPartyRow name="Vercel" purpose="Barındırma + API proxy" link="https://vercel.com/legal/privacy-policy" />
              </tbody>
            </table>
          </Section>

          {/* 5 */}
          <Section title="5. Veri Güvenliği">
            <p>
              OKX API anahtarları ve Telegram kimlik bilgileri tarayıcı localStorage'a
              yazılmadan önce <strong className="text-white">AES-256-GCM</strong> algoritması
              ile şifrelenir. Şifreleme anahtarı yalnızca Vercel sunucu ortamında bulunur ve
              kaynak kodda yer almaz.
            </p>
          </Section>

          {/* 6 */}
          <Section title="6. Çocukların Gizliliği">
            <p>
              Bu uygulama 18 yaş ve üzeri yetişkinlere yöneliktir. Kripto vadeli işlem
              ticareti büyük risk içerir. Bilerek 18 yaşın altındaki kişilerden veri
              toplamıyoruz.
            </p>
          </Section>

          {/* 7 */}
          <Section title="7. Haklarınız (KVKK / GDPR)">
            <ul className="space-y-1 pl-3">
              <li>· Verilerinize erişim talep edebilirsiniz</li>
              <li>· Verilerinizin silinmesini talep edebilirsiniz</li>
              <li>· Uygulama içi ayarlardan yerel veriyi sıfırlayabilirsiniz</li>
              <li>· Hesabınızı Clerk portalından silebilirsiniz</li>
            </ul>
            <p className="mt-2 text-[#9CA3AF]">
              Talepler için: <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#60A5FA] underline">{CONTACT_EMAIL}</a>
            </p>
          </Section>

          {/* 8 */}
          <Section title="8. Değişiklikler">
            <p>
              Bu politika güncellendiğinde uygulama içi bildirim veya e-posta ile
              bilgilendirme yapılacaktır. Sürekli kullanım güncel politikayı kabul
              ettiğiniz anlamına gelir.
            </p>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-[#4B5563]">
          <p>© 2026 QUANTIX OS — Ugur Ozdemir</p>
          <div className="mt-2 flex justify-center gap-4">
            <Link href="/terms" className="hover:text-[#9CA3AF] transition-colors">Kullanım Koşulları</Link>
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

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <h3 className="mb-1.5 text-xs font-bold text-[#D1D5DB]">{title}</h3>
      <ul className="space-y-1 pl-3 text-sm text-[#9CA3AF]">{children}</ul>
    </div>
  );
}

function ThirdPartyRow({ name, purpose, link }: { name: string; purpose: string; link: string }) {
  return (
    <tr>
      <td className="py-1.5 pr-4 font-bold text-white">{name}</td>
      <td className="py-1.5 pr-4 text-[#9CA3AF]">{purpose}</td>
      <td className="py-1.5">
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-[#60A5FA] underline">
          Politika →
        </a>
      </td>
    </tr>
  );
}
