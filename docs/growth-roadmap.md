# Growth Roadmap — QUANTIX OS

Sıralı 3 aşama, her biri bir öncekinin somut eşiğine bağlı (zamanlama değil,
eşik-tetikli). ROADMAP.md'nin ADIM 2 maddesindeki "sosyal medya/topluluk
büyütme kampanyaları yalnızca kanıt altyapısı çalışır duruma geldikten sonra
başlatılır" kuralının somutlaştırılmış hali.

## Aşama 1 — Telegram (şu an aktif)

- Kanal: `@quantixos_signals` (public) + VIP private kanal.
- Otomatik: her GO sinyali + sonuç takibi (win/loss) iki kanala da düşüyor,
  filtresiz, kayıp dahil şeffaf.
- **Hedef / Aşama 2 eşiği:** organik büyüme, VIP kanalda **100 üyeye**
  ulaşmak — bu sayı Aşama 2'yi tetikliyor.

## Aşama 2 — Discord (tetikleyici: Telegram VIP kanalda 100 üye)

- Mevcut Discord webhook altyapısı zaten var (kullanıcı-bazlı, client-side)
  — aynı otomatik sinyal+sonuç köprüsü Discord'a da bağlanacak.
- Bu eşiğe ulaşılmadan Discord'u açmayı erken başlatma — kalabalık olmayan
  bir sunucu ilk izlenimi zedeler.

## Aşama 3 — TikTok/YouTube (tetikleyici: Discord'da organik aktivite başladıktan sonra, kesin sayı yok, kullanıcı kararı)

- **Format:** haftalık özet video, **60-90 saniye, sadece sayılar** (o
  haftaki sinyal sayısı, kazanma oranı, en iyi/en kötü sinyal) — uzun
  format/detaylı anlatım YOK, üretim yükü düşük tutulacak, sürdürülebilirlik
  önceliği.
  - Gerekçe: günde 8-10 saat teknik işe zaten gidiyor, tek kişi — haftalık
    2-3 dakikalık düzenlemeli video üretimi zamanla sürdürülemez hale gelir.
    60-90sn'lik format hem TikTok/Shorts'un native formatına uyuyor hem de
    üretim yükünü düşük tutuyor.
- Ayda bir başlangıç kadansı, aktivite arttıkça sıklık artırılabilir.
- X/YouTube Community post/TikTok Content Posting API'lerinin otomasyon için
  uygun olmadığı zaten araştırıldı (X ücretli — pay-per-use, ücretsiz katman
  yok; YouTube'un public API'sinde metin-postu/Community-post endpoint'i
  hiç yok, sadece video yükleme var; TikTok Content Posting API onay/
  inceleme gerektiriyor) — bu aşamada video **manuel** yüklenecek, otomasyon
  yok.

## Ortak ilke (tüm aşamalarda)

Sosyal medya kampanyası/reklam, track-record sayfası + otomatik bildirim
altyapısı zaten çalışır durumda olduktan **SONRA** başlar.
