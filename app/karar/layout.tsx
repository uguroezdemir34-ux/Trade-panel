// Paylaşım kartı (components/karar/ShareButton.tsx → lib/share/exportShareCard.ts)
// tarayıcı ve sunucu tarafında AYNI kaynaktan font kullansın diye self-hosted
// — bkz. exportShareCard.ts dosya başı yorumu. ShareButton SADECE bu route'ta
// (/karar) render ediliyor, bu yüzden bu 4 ağırlık artık root layout'ta değil
// burada yükleniyor (perf teşhisinde bulundu: önceden koşulsuz her sayfada,
// /sign-in dahil, render-blocking CSS olarak yükleniyordu). Global CSS olduğu
// için layout/page dosyasından import edilmesi gerekiyor (Next.js kısıtı) —
// route-özel bir layout.tsx, root layout'ta zaten kanıtlanmış aynı desen.
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-mono/700.css";
// /karar'a özel CSS (glass-panel, panel-inset ailesi, ticker/flow
// animasyonları, pnl-breathe) — app/globals.css'ten taşındı (CSS
// temizliği teşhisi). Her selector /karar dışında hiç kullanılmıyor,
// tek tek grep ile doğrulandı — bkz. karar.css dosya başı yorumu.
import "./karar.css";

export default function KararLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
