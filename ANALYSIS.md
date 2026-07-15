# QUANTIX OS — Adım 1 (Client-Side API Entegrasyonu) Güvenlik Analizi

**Kapsam:** Salt-okunur kod taraması, hiçbir dosya değiştirilmedi. Aşağıdaki
4 soruya, dosya:satır referanslarıyla, dürüst (rahatlatıcı değil) bir
değerlendirme.

---

## 1. CORS ve Doğrudan Borsa Çağrı Sınırı

**Sonuç: Tüm yetkilendirilmiş OKX çağrıları zaten sunucu üzerinden
proxy'leniyor — client-direct authenticated call yok.** Ama "Layer 2" adlı
bir mekanizma, tarayıcının kendi OKX secret'ını her istekte sunucuya
göndermesine izin veriyor — bu, "secret hiç browser dışına çıkmaz"
iddiasından farklı bir güven modeli.

- `app/api/okx/[...path]/route.ts` — `/api/okx/api/v5/*` için catch-all
  proxy. Yorum: *"Güvenlik: OKX secret asla browser'a çıkmaz."* — bu,
  **Layer 1** (sunucu env-var credential'ları) için doğru, Layer 2 için
  değil (aşağıda).
- `lib/okx/server-handler.ts:103-107` — private endpoint'lerde önce
  `process.env`'den okunan Layer 1 credential'lar (`OKX_API_KEY` vb.)
  denenir; server'da bunlar yoksa **Layer 2 fallback** devreye girer:
  `req.clientCreds?.key` varsa (yani tarayıcı isteğin İÇİNDE kendi
  credential'ını gönderdiyse) o kullanılır.
- İmza `lib/okx/auth.ts:36-68` içinde SADECE server-side hesaplanıyor
  (`OK-ACCESS-SIGN = Base64(HMAC-SHA256(secret, ts+method+path+body))`) —
  dosya başı yorum bunun browser'a import edilmemesi gerektiğini açıkça
  belirtiyor.
- `lib/okx/client.ts:70-95` — browser client'ı HER ZAMAN kendi origin'ine
  (`/api/okx${path}`) istek atıyor, OKX'e doğrudan hiç gitmiyor.
- Layer 2 credential taşıma yolu somut olarak izlendi:
  `components/ayarlar/AccountBalanceCard.tsx:47-48` → kullanıcının
  `credentialStore`'da saklı OKX key/secret/passphrase'i header/body olarak
  `route.ts`'e gönderiliyor → `handleOkxProxy()` bunu o TEK istek için
  kullanıp atıyor (server'da persist edilmiyor).
- Emir yerleştirme (`close-position`, `cancel-algos`, `fills`, `positions`)
  dahil TÜM trade-ilişkili çağrılar `/api/okx/api/v5/...` proxy yolunu
  kullanıyor (`lib/okx/close-position.ts:35` vb.) — direkt `okx.com` çağrısı
  yok.
- `next.config.ts`'de ne `serverComponentsExternalPackages` ne `headers()`
  ne `rewrites()` var — **CLAUDE.md §11'deki "OKX sırları sunucu tarafında
  (next.config.ts serverComponentsExternalPackages)" iddiası dosyanın gerçek
  içeriğiyle örtüşmüyor.** Secret'lar gerçekten server-side (yukarıda
  kanıtlandı), ama bu mekanizma üzerinden değil — bu bir dokümantasyon
  hatası, güvenlik açığı değil, ama düzeltilmeli.
- Repo genelinde client-side kod içinde doğrudan `https://www.okx.com`'a
  authenticated fetch YOK. Bulunan tek client-direct OKX bağlantıları
  public/unauthenticated WebSocket fiyat akışları (`wss://ws.okx.com...`,
  `lib/hooks/useLiqFeed.ts:108-110` vb.) — bunlar secret gerektirmiyor,
  proxy-bypass riski taşımıyor.
- **Not:** Eski, kullanımdan kalkmış `panel_v56.html` (510KB, repo kökünde,
  `app/`/`components/`/`lib/`'e hiçbir referansı yok) içinde
  `okxFetch`/`okxPost` browser'dan doğrudan OKX'e gidiyordu — bu ESKİ
  mimari, aktif Next.js uygulamasının parçası DEĞİL.

**Değerlendirme:** Stateless proxy mimarisi zaten kurulu ve çalışıyor —
Adım 1'in "sunucuda veri saklamayan proxy" hedefi Layer 1 için tam
karşılanıyor. Layer 2 fallback ise custody sorumluluğunu tam olarak
"eritmiyor" — kullanıcının secret'ı sunucu process'inden (persist edilmeden
de olsa) geçiyor. Bu, CORS kısıtından kaçınmak için makul bir mühendislik
kararı, ama "secret'lar asla sunucuya değmiyor" diye pazarlanamaz.

---

## 2. Tehdit Modeli ve XSS Riski

**Sonuç: Şifreleme primitive'i (AES-256-GCM) kriptografik olarak sağlam,
ama anahtar yönetimi bu korumayı büyük ölçüde etkisiz kılıyor.**

- `lib/store/secure-storage.ts` — `crypto.subtle` (Web Crypto API) ile
  AES-256-GCM, her yazımda rastgele 96-bit IV (`encryptValue()`, satır
  193-213), format `"ENC1:" + base64(IV||ciphertext)`. Bu kısım doğru
  uygulanmış.
- **Kritik bulgu:** Anahtar (`getOrCreateSessionKey()`, satır 140-176)
  kullanıcı şifresinden/PIN'den türetilmiyor — tarayıcıda rastgele
  üretiliyor VE **`window.localStorage`'a** (`getKeyStorage()`, satır
  66-75), verinin kendisiyle **AYNI storage'a**, `"ug52_sk"` anahtarıyla
  yazılıyor (satır 169). Dosyanın kendi yorumu (satır 13-18) ve sabit adı
  (`SESSION_KEY_NAME`) "sessionStorage" izlenimi veriyor ama kod fiilen
  `localStorage` kullanıyor — yorum/kod uyumsuzluğu.
- **Anlamı:** Şifreleme anahtarı VE şifreli veri aynı origin'de, aynı
  JS erişim düzeyinde duruyor. Sayfada çalışabilen HERHANGİ bir script
  (XSS veya kötü niyetli bir browser eklentisi) `importKey()`'i
  (satır 122-128, export edilmiş) çağırıp anahtarı okuyup veriyi
  kendi başına çözebilir.

**Dürüst risk transferi değerlendirmesi:** Bu mimari, sunucu ihlali riskini
gerçekten azaltıyor (server'da API key persist edilmiyor). Ama karşılığında
aldığı XSS riski, "şifreleme" etiketinin ima ettiğinden çok daha yüksek —
çünkü anahtar da tarayıcıda, veriyle birlikte duruyor. Tek gerçek koruma
kapsamı: JS ÇALIŞTIRAMAYAN ama disk/profil dosyalarına erişimi olan bir
saldırgan (örn. çalınmış bir laptopta ham dosyaları grep'leyen biri) artık
düz metin "okx" arayarak bulamaz. XSS senaryosunda bu koruma **sıfıra
iner** — mevcut yapı bunu iddia etmiyor olsa da, "AES-256-GCM ile şifreli"
ifadesi kullanıcıya olduğundan güçlü bir güvence izlenimi verebilir.

---

## 3. Şifre Çözme Anahtarı Yönetimi

**Sonuç: Şu an ne dinamik bir kullanıcı PIN'i, ne de kod içine gömülü sabit
bir anahtar var — üçüncü, dokümante edilmemiş bir üçüncü model: rastgele
üretilip veriyle birlikte localStorage'a yazılan bir anahtar.**

- `STATE_ENCRYPTION_KEY` (CLAUDE.md §11'de "Vercel env'de" diye belgelenmiş,
  gerçek görünümlü bir base64 değeriyle birlikte) `lib/config/env.ts:150-156`
  içinde okunuyor ve yoksa uyarı basıyor ("localStorage şifrelemesi
  browser-key moduna düşüyor") — ama **`cfg.stateEncryptionKey` repo
  genelinde `lib/config/env.ts` dışında HİÇBİR YERDE kullanılmıyor.**
  `secure-storage.ts` bu değeri hiç okumuyor, `process.env`'e hiç
  dokunmuyor — %100 kendi kendine yetenekli, tarayıcı-üretimli anahtar
  mantığı.
- **Yani `STATE_ENCRYPTION_KEY` şu an ölü/hedeflenen ama uygulanmamış bir
  konfigürasyon.** `env.ts`'deki uyarı metni, sunucu-destekli bir anahtar
  modelinin planlandığını ama hiç bağlanmadığını gösteriyor.
- Sabit/gömülü bir anahtar KULLANILMIYOR (bu iyi — sabit anahtarlar zaten
  XSS'e karşı hiçbir koruma sağlamaz, kaynak kodunda/bundle'da herkese
  açık olurdu). Ama mevcut "rastgele üret + aynı yere yaz" modeli de
  pratikte benzer bir sonuca varıyor: anahtar her zaman veriyle birlikte,
  bir XSS'in erişebileceği yerde.

**Öneri (aksiyon değil, sadece analiz):** Gerçek bir güvenlik kazanımı için
anahtar, kullanıcının HER SEFERİNDE girdiği bir PIN/parola'dan
(`PBKDF2`/`Argon2` ile türetilerek, RAM'de tutulup disk/localStorage'a asla
yazılmadan) türetilmeli. Bu, UX maliyeti (her session'da PIN girme)
karşılığında gerçek bir "sunucu ihlali VE XSS'e karşı" koruma sağlar. Mevcut
model sadece birincisine karşı koruma sağlıyor.

---

## 4. Mevcut Güvenlik Duvarı Kontrolü

**Sonuç: XSS saldırı yüzeyi şu an temiz görünüyor, ama hiçbir HTTP güvenlik
header'ı (CSP dahil) yapılandırılmamış — yani gelecekte açılacak herhangi
bir sink için hiçbir defense-in-depth katmanı yok.**

- `dangerouslySetInnerHTML` repo genelinde sadece **2 yerde**, ikisi de
  `app/layout.tsx`'te, ikisi de SABİT string literal (kullanıcı/API verisi
  YOK):
  - satır 66-70: theme FOUC-önleme script'i — `localStorage`'dan `theme`
    değerini okuyup `setAttribute('data-theme', v)`'e yazıyor (ileri
    `innerHTML`/`eval` yok).
  - satır 73-79: sadece `NODE_ENV==="development"`'ta aktif debug overlay,
    `el.textContent` kullanıyor (`innerHTML` değil), production build'den
    çıkarılıyor.
- Haber akışı (`lib/news/`), Telegram mesajları, parite isimleri, i18n
  metinleri — hiçbiri `dangerouslySetInnerHTML`/raw HTML ile render
  edilmiyor; React'in varsayılan JSX text-node kaçışı (auto-escape)
  kullanılıyor.
- Telegram formatlaması (`lib/notify/telegram/escape.ts`) MarkdownV2 özel
  karakterlerini düzgün escape ediyor (`escapeMarkdownV2()`, satır 42-56) —
  ama bu Telegram-tarafı injection'a karşı, bu uygulamanın kendi DOM'una
  karşı değil (zaten oraya render edilmiyor).
- **`next.config.ts`, `middleware.ts`, `vercel.json` — üçünde de HİÇBİR
  güvenlik header'ı yok.** `Content-Security-Policy`, `X-Frame-Options`,
  `X-Content-Type-Options`, `Strict-Transport-Security` — hiçbiri
  tanımlanmamış. `middleware.ts` sadece Clerk auth gate'i yapıyor (private
  route'ları koruyor), header eklemiyor.
- `package.json`'da DOMPurify/`sanitize-html`/`xss` gibi bir sanitization
  kütüphanesi YOK — şu an ihtiyaç da yok (temiz sink), ama ileride
  news feed/kullanıcı girdisi için `dangerouslySetInnerHTML` açılırsa
  hazır bir araç yok.

**Acil yapılması gerekenler (öncelik sırasıyla):**
1. `next.config.ts`'e `headers()` ile temel güvenlik header'ları eklenmeli:
   en azından `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
   (veya `SAMEORIGIN`), `Strict-Transport-Security`. CSP, mevcut inline
   script'ler (`app/layout.tsx`'teki iki `<script>`) nedeniyle `nonce`
   veya `'unsafe-inline'` gerektirecek — dikkatli tasarlanmalı.
2. Anahtar yönetimi modeli (Soru 3) yeniden tasarlanmalı.
3. `CLAUDE.md:324`'teki gerçek görünümlü `STATE_ENCRYPTION_KEY` değeri
   rotate edilmeli (aşağıya bakın — bu ayrı ve en acil madde).

---

## Ek bulgu: `EXECUTION_MODE=LIVE` gerçekte ne yapıyor?

Rapor kapsamınıza girmiyordu ama doğruluk için önemli: **`EXECUTION_MODE=LIVE`
otomatik canlı emir açtırmıyor.** İki ayrı bayrak var:
- `EXECUTION_MODE` (server, `NEXT_PUBLIC_` öneki yok) sadece proxy'nin hangi
  credential setini (`live`/`demo`) tercih ettiğini belirliyor —
  `lib/config/env.ts:100-105`.
- Gerçek emir-gönderme UI'ı ayrı bir bayrakla kapalı:
  `lib/config/execution.ts:1-4` — `EXECUTION_ENABLED =
  process.env.NEXT_PUBLIC_EXECUTION_MODE === "LIVE"`. Bu `false` iken
  `QuickTradeSheet.tsx:88-93` submit'i reddedip "sinyal modu aktif" hatası
  gösteriyor.
- Bu bile `true` olsa, çağıracağı adaptör bilerek stub: `lib/exchange/index.ts`
  — `getAdapter()` koşulsuz `throw` ediyor, yorumda "Set
  NEXT_PUBLIC_EXECUTION_MODE=LIVE only after full security review" yazıyor.
  `POST /api/v5/trade/order` (gerçek emir endpoint'i) aktif kodda HİÇ
  çağrılmıyor — sadece ölü `panel_v56.html`'de var.
- Otomatik çalışan tek şey: cron job'lar (`vercel.json`) → `signalEngine.ts`
  → public OKX verisiyle skor hesaplayıp Telegram'a bildirim gönderiyor —
  emir açmıyor.

**Sonuç:** Bugünkü gerçek risk "yetkisiz otomatik trade" değil, "credential
saklama/taşıma" (Soru 1-2-3) ve bildirim bütünlüğü. "LIVE" ismi ürkütücü
görünse de, emir açma kod yolu şu an fiziksel olarak yok (sadece
"kapalı" değil, hiç yazılmamış).

---

## Önem sırasına göre en aksiyona-dönük bulgular

1. **`CLAUDE.md:324`'te sızmış bir secret** — gerçek görünümlü bir
   `STATE_ENCRYPTION_KEY` değeri repoya düz metin commit edilmiş. Bu değer
   gerçekten Vercel prod'da kullanıldıysa (kullanılmıyor olsa bile),
   sızmış sayılıp derhal rotate edilmeli.
2. **Anahtar/şifreli veri aynı storage'da** (`secure-storage.ts`,
   `getKeyStorage()` → `localStorage`) — "AES-256-GCM şifreli" etiketinin
   ima ettiği güvenceyi XSS senaryosunda sağlamıyor.
3. **`STATE_ENCRYPTION_KEY` ölü kod** — dokümantasyon (CLAUDE.md) var
   olmayan bir sunucu-destekli anahtar modelini anlatıyor; gerçek tehdit
   modelini yanlış yansıtıyor.
4. **Layer 2 credential akışı** kullanıcı secret'ını (persist edilmeden de
   olsa) sunucu process'inden geçiriyor — "secret hiç sunucuya değmez"
   iddiasıyla tam örtüşmüyor.
5. **Hiçbir güvenlik header'ı/CSP yok** — bugün XSS sink'i temiz olduğu
   için düşük risk, ama defense-in-depth katmanı eksik.
6. Canlı emir açma UYGULANMAMIŞ — panelin adının çağrıştırdığından daha
   düşük risk, raporun doğruluğu için belirtilmeli.

Bu rapor salt-okunur bir tarama sonucudur, hiçbir dosya değiştirilmedi.
