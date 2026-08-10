# QUANTIX OS — Play Store Yayın Checklist

Tüm maddeler **senin** tarafından yapılmalıdır. Kod tarafında hazır olanlar ayrıca belirtildi.

---

## 1. Google Play Console Hesabı

- [ ] [play.google.com/console](https://play.google.com/console) adresinden geliştirici hesabı oluştur
- [ ] Tek seferlik $25 kayıt ücreti öde
- [ ] Developer profile'ı (ad, e-posta, fiziksel adres) doldur
- [ ] **Yeni uygulama oluştur:** "QUANTIX OS", Türkçe, Uygulama (Oyun değil)

---

## 2. Keystore (İmzalama Anahtarı)

- [ ] `chmod +x scripts/create-keystore.sh && ./scripts/create-keystore.sh` çalıştır
- [ ] `release.jks` dosyasını güvenli yerde sakla (1Password, Bitwarden vb.)
  - **Kritik:** Kaybedersen Play Store güncellemesi gönderemezsin
- [ ] GitHub Secrets'a ekle (Settings → Secrets → Actions → New secret):
  - [ ] `ANDROID_KEYSTORE_BASE64` — script çıktısındaki base64 değeri
  - [ ] `ANDROID_KEY_ALIAS` — `quantixos-key`
  - [ ] `ANDROID_KEY_PASSWORD` — keytool'da seçtiğin şifre
  - [ ] `ANDROID_STORE_PASSWORD` — keytool'da seçtiğin şifre

---

## 3. Uygulama Kimliği (appId)

Şu an: `com.quantixos.trading` (tamamlandı)

- [ ] Siyah ekran sorunu çözülünce `capacitor.config.ts`'de appId'yi değiştir:
  ```
  com.quantixos.trading.test7  →  com.quantixos.trading
  ```
- [ ] Play Console'da aynı appId'yi kullan (bir kez yayınlanınca değiştirilemez)

---

## 4. Clerk Production Anahtarları

- [ ] [clerk.com](https://clerk.com) → QUANTIX OS uygulaması → Production ortamı
- [ ] Production `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` al (pk_live_... ile başlar)
- [ ] Production `CLERK_SECRET_KEY` al (sk_live_... ile başlar)
- [ ] GitHub Secrets'a ekle:
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (production key)
  - [ ] `CLERK_SECRET_KEY` (production key)

---

## 5. Uygulama İkonu ve Splash Görselleri

**Kod hazır:** `.github/workflows/android-release-aab.yml` → `@capacitor/assets generate` adımı var.

- [ ] `assets/icon.png` → **Gerçek logonla değiştir**
  - Boyut: 1024×1024 piksel, PNG, şeffaf veya düz arka plan
  - Güvenli alan: İkonun ana içeriği ortada 820×820 px içinde kalsın
- [ ] `assets/splash.png` → **Gerçek splash görseliyle değiştir**
  - Boyut: 2732×2732 piksel, PNG
  - Merkeze küçük logo koy, kenar boşlukları geniş tut (farklı ekran oranları için)
- [ ] Placeholder'ları test etmek için: `python3 scripts/create-placeholder-assets.py`

---

## 6. Play Store Görselleri (Play Console'a Yükle)

- [ ] **Ekran görüntüleri** — telefon için en az 2, en fazla 8 adet (minimum 320px, maksimum 3840px)
  - Önerilen: 1080×1920 veya 1080×2340 PNG/JPG
  - İçerik: Karar sayfası, Grafik sayfası, PnL sayfası, Piyasa sayfası
- [ ] **Feature Graphic** — 1024×500 piksel PNG/JPG (Play Store liste görünümü)
- [ ] **Uygulama ikonu** — 512×512 piksel PNG (Play Console'a ayrıca yükle)

---

## 7. Uygulama Açıklamaları (Play Console → Store Listing)

- [ ] **Kısa açıklama** (maks. 80 karakter):
  ```
  Kripto vadeli işlem trading paneli — BTC, ETH ve 13 parite
  ```
- [ ] **Tam açıklama** (maks. 4000 karakter) — Türkçe ve İngilizce hazırla

---

## 8. Gizlilik Politikası

Play Store, finansal uygulama + Clerk auth nedeniyle gizlilik politikası zorunlu tutar.

- [ ] Bir gizlilik politikası URL'si hazırla (örn. Notion public sayfası veya basit HTML)
  - Belirtilmesi gerekenler: hangi verilerin toplandığı, OKX API key'lerin şifreli saklanması, Clerk auth
- [ ] Play Console → Policy → Privacy Policy URL alanına ekle

---

## 9. İçerik Derecelendirmesi

- [ ] Play Console → Content rating → Anket doldur
  - Kategori: Finance (Finans)
  - Şiddet/yetişkin içerik: Yok
  - Sonuç: PEGI 3 veya Everyone olması beklenir

---

## 10. Hedef Kitle ve İçerik

- [ ] Target audience: 18+ (finansal uygulama)
- [ ] Data safety formu doldur:
  - OKX API key: cihazda şifreli saklanıyor (AES-256-GCM), üçüncü taraflarla paylaşılmıyor
  - Clerk: kimlik doğrulama için e-posta işleniyor
  - Konum verisi: toplanmıyor

---

## 11. Release (AAB Yükleme)

- [ ] GitHub Actions → "Android Release AAB (Play Store)" → Run workflow
  - `version_name`: `1.0.0`
  - `version_code`: `1`
- [ ] İndirilen `quantix-os-release-aab` artifact'ı zip'i aç → `app-release.aab` al
- [ ] Play Console → Production → Create new release → AAB yükle
- [ ] Release notes (Türkçe): "İlk sürüm"

---

## 12. Son Kontroller (Release Öncesi)

Kod tarafında zaten yapılmış:

- [x] `android:hardwareAccelerated="true"` — AndroidManifest'te var (CI patchler)
- [x] `targetSdk 35` — Capacitor 7, Android 16 uyumlu
- [x] `versionCode=1`, `versionName="1.0.0"` — CI patchler
- [x] `webContentsDebuggingEnabled: false` yapmayı unutma (release build'de)

Senin yapman gerekenler:

- [ ] `capacitor.config.ts`'de `webContentsDebuggingEnabled: false` yap (release için)
- [ ] `android.backgroundColor`'ı `#FF0000` tanı kırmızısından `#000000`'a çevir (release için)
- [ ] Release AAB workflow test run yap, AAB başarıyla oluşuyor mu doğrula

---

## Özet Akış

```
1. Siyah ekran fix (adb logcat ile)
2. appId → com.quantixos.trading
3. Keystore oluştur + GitHub Secrets'a ekle
4. Clerk production keys → GitHub Secrets'a ekle
5. Gerçek ikon/splash → assets/ klasörüne koy
6. Release AAB workflow çalıştır → AAB indir
7. Play Console'da uygulama oluştur + form doldur
8. AAB yükle → İncelemeye gönder (~3-7 gün)
```
