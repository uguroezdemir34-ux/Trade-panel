# QUANTIX Signal Engine v2 — Mimari Tasarım Dokümanı

**Tarih:** 2026-08-04
**Durum:** Taslak — karar için hazırlandı, henüz uygulamaya alınmadı
**Kapsam:** `lib/score/` sınırı, QUANTIX OS içindeki "korunacak çekirdek" tamamen dışarıda

---

## 1. Amaç — Signal Engine v1 neden yetersiz kaldı

### Ne test edildi

6 aylık pooled backtest verisi (163-466 trade arası, veri zenginleştikçe yeniden taranan üç ayrı JSON seti) üzerinde, kazanan/kaybeden trade'i ayırt edecek bir sinyal aranarak 8 hipotez sırayla test edildi. Her biri Pearson korelasyonu, bucket/WR kırılımı ve mümkün olduğunda walk-forward (kronolojik, sızıntısız) doğrulama ile ölçüldü.

| # | Hipotez | Yöntem | Sonuç |
|---|---|---|---|
| 1 | Kategori alt-skorları (trend/adx/rsi/vol/bb/vwap) | Ortalama fark, korelasyon | Ayırt etmiyor (fark <0.32 puan) |
| 2 | Geç giriş (consecutiveGoBars/scoreHistory eğimi) | Korelasyon | ~0 |
| 3 | ATR volatilite patlaması (atrPercentile/atrRegime/atrRatio) | Korelasyon | 0.07–0.10 |
| 4 | srModifier/sweepBonus (kod-doğrulanmış, gerçek) | Korelasyon | -0.070/-0.002, yön ters |
| 5 | Trend-hizalama (trailingReturn30d ile yön uyumu) | Walk-forward | İlk sette umut vericiydi, yeni veri setinde tekrarlanmadı |
| 6 | XGBoost/ML — tüm bilinen değişkenler | Walk-forward AUC | 0.50–0.54, pratikte rastgele |
| 7 | Seans/saat (hour/session/dow) | Walk-forward AUC + kural testi | AUC 0.50→0.55, basit kural 4/4 ay + 7/8 paritede tutarlı — **tek pozitif bulgu**, kullanıcı tarafından reddedildi (ABD seansı öznel olarak en iyi fırsat penceresi) |
| 8 | Ham volRatio (sürekli, subScores.vol'un kategorik halinden 247× daha zengin) | Korelasyon + bucket | +0.064, monotonik değil — kategorik versiyonla aynı sonuç |

Ayrıca MFE/MAE analizi (ayırt edicilik testi değil, ayrı bir gözlem): kayıpların %35.3'ü hiç lehe gitmeden kaybediyor (giriş zamanlaması sorunu), SL trade'lerin %42'sinde maeR>1.3 (backtest'in slippage'i hafife aldığı bir risk alanı).

### Sonucun anlamı

8 hipotezin 7'si, teknik göstergelerin (fiyat/hacim türevi, gecikmeli) hiçbir alt kümesinde veya kombinasyonunda anlamlı ayırt edicilik bulamadı — tek istisna (seans) da kullanıcı tarafından reddedildi ve mekanizması açıklanamadı. Bu, ince ayarın tükendiğinin kanıtı: sorun eşik kalibrasyonunda veya ağırlıklandırmada değil, **veri kaynağının kendisinde**. Mevcut motor tamamen fiyat/hacim geçmişinden türetilmiş göstergelere dayanıyor — bunların hepsi zaten fiyata gömülü, gecikmeli bilgi. "Piyasa neden hareket ediyor" sorusuna cevap veren hiçbir veri (kim işlem açıyor, nerede likidasyon riski var, spot/futures ayrışması var mı) motöre hiç girmiyor.

---

## 2. Korunacak Modüller (dokunulmayacak)

Bu liste kapsam dışı — herhangi bir v2 çalışması bu modüllerin arayüzünü/davranışını değiştirmez, sadece Signal Engine'den yeni girdi tüketebilirler:

- **Risk Engine** (guardrail'ler: kaldıraç limiti, günlük zarar circuit-breaker)
- **Position Sizing** (`lib/sizer/`)
- **Exit Simulator** (`lib/backtest/exitSimulator.ts`)
- **Backtest Engine** (`lib/backtest/engine.ts`) — v2 test edilirken aynı motor kullanılacak, sadece yeni opsiyonel alanlar export edilecek (v1'deki desen: srModifier/mfeR/volRatio gibi)
- **Order Execution** — zaten yok (Execute butonu kaldırıldı, sistem emir göndermiyor)
- **Alert System** (Telegram, GO teyit rozeti, CONFIRM_DELAY_MS mantığı)
- **Dashboard / `/karar` UI** — v2 sonuçları mevcut ScoreBreakdown'a yeni satır(lar) olarak eklenebilir, sayfa mimarisi değişmez
- **Reporting** (`/pnl`, PerformancePanel, DisciplineCard)

---

## 3. Signal Engine v2 — Veri Kaynakları

> Not: Aşağıdaki API/endpoint bilgileri eğitim verisine dayanıyor; bu konuşmada canlı doğrulama (web araması) yapılmadı. Entegrasyona başlamadan önce OKX'in güncel API dokümantasyonuyla teyit edilmeli.

### 3.1 Open Interest (OI)

- **Neden önemli?** Fiyat hareketiyle birlikte OI artışı/azalışı, hareketin yeni pozisyon girişiyle mi (trend'in "gerçek" olma ihtimali yüksek) yoksa pozisyon kapanışıyla mı (short squeeze/long liquidation, tükenme sinyali) desteklendiğini ayırt eder. Mevcut motorun hiç görmediği bir boyut.
- **Spot/Futures farkı:** Spot'ta OI kavramı yok (mülkiyet, kaldıraç yok); QUANTIX zaten SWAP/perp odaklı olduğu için bu ayrım doğrudan uygulanabilir — OI verisi doğal olarak futures/perp'e özel.
- **API:** OKX `/api/v5/public/open-interest` (anlık snapshot, kimlik doğrulama gerektirmiyor). Tarihsel için `/api/v5/rubik/stat/contracts/open-interest-volume` (OI+hacim, bar bazlı — 5m/1H/1D).
- **Tarihsel veri:** Kısıtlı — rubik endpoint'i genelde son birkaç ay/sınırlı pencere sunar, backtest'e yıllar öncesine dönük OI beslemek mümkün olmayabilir. Backtest doğrulaması bu yüzden dar bir pencereyle sınırlı kalabilir.
- **Maliyet:** Ücretsiz (public endpoint).
- **Zorluk:** Düşük-orta — endpoint'i çekmek kolay, ama anlamlı sinyale çevirmek (OI değişim hızı + fiyat yönü matrisi) yeni mantık gerektiriyor.
- **Beklenen katkı:** Orta-yüksek — mevcut motorda **zaten kısmen var**: `orchestrator.ts`'te `oiVelocityScore`/`oiBonus` (±10 puan, total'e giriyor) ve `oiDivergenceContrib` (gölge modda, hiç etkisi yok) bulundu. Yani altyapı kısmen kurulu ama gölge modda — önce mevcut sinyalin gerçek etkinliği ölçülmeli, sıfırdan başlanmıyor.

### 3.2 Funding Rate

- **Neden önemli?** Aşırı pozitif funding = piyasa aşırı long, squeeze riski; aşırı negatif = aşırı short. Sürü davranışının doğrudan fiyatlandığı, gecikmesiz bir gösterge.
- **Spot/Futures farkı:** Sadece perp'e özel mekanizma (spot'ta karşılığı yok).
- **API:** OKX `/api/v5/public/funding-rate` (anlık) + `/api/v5/public/funding-rate-history` (tarihsel, listeleme tarihinden itibaren, sayfalanmış).
- **Tarihsel veri:** İyi — funding rate history genelde borsanın tüm geçmişini kapsıyor, backtest için en sağlam kaynaklardan biri.
- **Maliyet:** Ücretsiz.
- **Zorluk:** Düşük — zaten kısmen entegre (`funding rate scoring recalibrated to real OKX market conditions, extreme=±0.05%, hard block=±0.10%` — mevcut kayıtlarda var). Asıl iş, bunu tekil eşik/blok yerine sürekli bir skor bileşenine çevirmek.
- **Beklenen katkı:** Orta — düşük zorluk ve zaten kısmen doğrulanmış veri kaynağı olması nedeniyle hızlı kazanım adayı, ama tek başına edge üretme ihtimali OI/order-flow kadar yüksek değil (sürü göstergesi, çoğu zaman gecikmeli teyit).

### 3.3 Liquidation Heatmap

- **Neden önemli?** Kümelenmiş likidasyon seviyeleri, fiyatın "mıknatıslanacağı" bölgeleri gösterir — S/R'den farklı, pozisyon verisine dayalı bir hedef/risk haritası.
- **Spot/Futures farkı:** Tamamen futures/perp'e özel.
- **API:** OKX `/api/v5/public/liquidation-orders` gerçek likidasyonları veriyor ama genelde geriye dönük kısıtlı ve **tahmini** (henüz gerçekleşmemiş) likidasyon kümelerini vermiyor — bu, "heatmap" dediğimiz şeyin asıl değerli kısmı, borsa API'lerinde native olarak yok. Coinglass/Hyblock gibi üçüncü parti agregatörler bunu OI+kaldıraç dağılımından modelleyerek üretiyor.
- **Tarihsel veri:** Zayıf — native OKX endpoint'i sınırlı geçmiş sunuyor, tahmini heatmap için zaten üçüncü parti kaynak şart.
- **Maliyet:** Native veri ücretsiz ama sınırlı değerde; gerçek heatmap için üçüncü parti API'ler genelde ücretli abonelik gerektiriyor.
- **Zorluk:** Yüksek — ya kendi tahmini modelini kurmak (OI+kaldıraç dağılımı varsayımlarından, doğruluğu belirsiz) ya da dış ücretli API'ye bağımlı kalmak.
- **Beklenen katkı:** Belirsiz/spekülatif — kavramsal olarak cazip ama veri kaynağının kendisi güvenilir değil; en riskli veri kaynağı adayı.

### 3.4 CVD / Delta (Cumulative Volume Delta)

- **Neden önemli?** Alıcı-mı-satıcı-mı agresif diye ayırt eder (fiyat yatay kalırken CVD yön değiştiriyorsa gizli birikim/dağıtım sinyali) — OHLCV'nin veremediği bir çözünürlük.
- **Spot/Futures farkı:** Her ikisinde de hesaplanabilir, perp'te funding/OI ile birleştiğinde daha anlamlı.
- **API:** Native "CVD" endpoint'i yok — ham trade tape'ten (`/api/v5/market/trades` REST veya WS `trades` kanalı) kendi hesaplanması gerekiyor.
- **Tarihsel veri:** REST üzerinden sadece son ~500 trade — uzun geçmiş için native yol yok, sadece ileriye dönük kendi biriktirdiğin veriyle büyür.
- **Maliyet:** Ücretsiz veri, ama depolama/işlem maliyeti var (sürekli trade akışı).
- **Zorluk:** Düşük — **altyapı zaten kurulu**: `lib/orderflow/tradeFeed.ts` içinde ring buffer tabanlı trade ingestion (VPIN için kullanılıyor) zaten CVD/tape reader'ın temelini atmış durumda. Yeniden sıfırdan kurulmuyor, üzerine CVD hesaplaması eklenecek.
- **Beklenen katkı:** Orta-yüksek — mevcut altyapıya en ucuz eklenebilecek kaynak, backtest'e geriye dönük beslenemeyeceği için doğrulaması ancak ileriye dönük (forward-test) yapılabilir — bu bir kısıt.

### 3.5 Order Book Imbalance

- **Neden önemli?** Görünür alım/satım duvarlarının dengesizliği, kısa vadeli fiyat baskısını gösterir.
- **Spot/Futures farkı:** İkisinde de mevcut, spread/derinlik farkı borsaya göre değişir.
- **API:** OKX WS `books` kanalı (derinlik, gerçek zamanlı) veya REST `/api/v5/market/books` (snapshot, en fazla 400 seviye).
- **Tarihsel veri:** Yok — order book durumu anlık, geçmişe dönük native arşiv olmuyor; backtest ancak kendi kaydettiğin veriyle mümkün.
- **Maliyet:** Ücretsiz veri, yüksek hacimli gerçek zamanlı akış nedeniyle depolama/bant genişliği maliyeti var (kullanıcının kendi eklediği risk notu — haklı).
- **Zorluk:** Düşük-orta — **kısmen kurulu**: `/grafik` sayfasında order book wall tooltip zaten derinlik verisini (`sz=5→20`) çekiyor. Skor motoruna girecek bir "imbalance oranı" hesaplaması eksik ama veri erişimi hazır.
- **Beklenen katkı:** Orta — çok kısa vadeli (saniyeler-dakikalar) bir sinyal, sistemin 1H ana + 4H teyit ufkuyla ne kadar uyumlu olacağı belirsiz; en düşük "ufuk uyumu" riski taşıyan kaynak.

### 3.6 Market Regime Detection

- **Trend / Range / Expansion / Compression — nasıl tespit edilir?**
  - Trend: ADX eşiği + yönlü hareket (mevcut `adaptiveWeights.ts` zaten trending_strong/ranging rejim ayrımı yapıyor)
  - Range: düşük ADX + fiyatın dar bantta salınımı (BB genişliği düşük)
  - Expansion: ATR percentile artışı + BB genişliği açılması
  - Compression: ATR percentile düşük + BB sıkışması (genelde expansion'ın öncüsü)
- **Önemli ayrım — daha önce test edilenle karıştırılmamalı:** Hipotez 3 (ATR rejimi TEK BAŞINA kazanan/kaybeden ayırt eder mi) test edildi ve reddedildi. v2'de önerilen kullanım FARKLI: rejim, bağımsız bir skor bileşeni değil, **diğer sinyallerin (OI, CVD, funding) yorumlanma bağlamı** olacak — örn. "range rejiminde order book imbalance daha güvenilir, trend rejiminde OI velocity daha güvenilir" gibi etkileşim etkileri. Bu, reddedilen hipotezin tekrarı değil, test edilmemiş bir kullanım.
- **API/maliyet/zorluk:** Yeni veri kaynağı gerektirmiyor — mevcut candle verisinden (zaten çekiliyor) hesaplanıyor. En ucuz bileşen.
- **Beklenen katkı:** Doğrudan ölçülemez (kendi başına bir sinyal değil, çarpan/filtre katmanı) — ama diğer kaynakların etkinliğini artırma potansiyeli var, bu yüzden bağımsız değil diğer kaynaklarla birlikte değerlendirilmeli.

---

## 4. Signal Fusion Architecture

Amaç: 5 yeni kaynağı (Funding, OI, CVD, Order Book, Regime) tek bir GO/WAIT/NO kararına dönüştürürken, mevcut motorun **şeffaf, katkı bazlı toplama** mimarisini (baseScore + sweepBonus + regimeBonus + srModifier + oiBonus, hepsi ayrı ayrı loglanabilir) kırmadan genişletmek. ML/ensemble/kara kutu bir birleştirici **kasıtlı olarak reddedildi** — hipotez 6'da XGBoost zaten denendi (walk-forward AUC 0.50-0.54, rastgele) ve sonuç motoru daha az açıklanabilir kılmadan bir kazanım sağlamadı. Kara kutu, hem bu veriyle gerekçesiz hem de kullanıcının açık isteğiyle çelişiyor.

### 4.1 İki katmanlı yapı: Modifier'lar + Rejim Çarpanı

**Katman A — Bağımsız modifier'lar (4 kaynak, her biri kendi başına yorumlanabilir bir sayı üretir):**

```
oiModifier      = clamp(-10, +10, f_oi(oiVelocity, priceDirection))
fundingModifier = clamp( -8,  +8, f_funding(fundingRate))
cvdModifier     = clamp( -8,  +8, f_cvd(cvdSlope, priceSlope))
obiModifier     = clamp( -6,  +6, f_obi(bidVolume, askVolume))
```

Her fonksiyon basit, tek-yönlü ve kod yorumunda gerekçesi yazılı olacak — örnek: `f_oi`, fiyat yükselirken OI artıyorsa (yeni long girişi, "gerçek" trend) pozitif, fiyat yükselirken OI düşüyorsa (short squeeze, tükenme) negatif döner. Hiçbiri diğerinin çıktısını girdi olarak almaz — bu, her birinin bağımsız test edilebilmesini garanti eder (bkz. 4.4).

**Katman B — Rejim çarpanı (Market Regime Detection, bölüm 3.6'daki tanım):**

```
regimeMultiplier[source][regime] ∈ [0.0, 1.4]
```

4 kaynak × 4 rejim (trending_strong / ranging / expansion / compression) için 16 hücrelik bir çarpan tablosu. Mantığı: aynı ham modifier değeri, farklı rejimlerde farklı güvenilirlikte. Örnek varsayım (kalibre edilecek, aşağıda kritik uyarı var): order book imbalance, range/compression'da (kısa vadeli baskı anlamlı) yüksek ağırlık; trending_strong'da (gürültüye gömülür) düşük ağırlık.

**Toplama:**

```
fusionScore = Σ_source [ regimeMultiplier[source][currentRegime] × rawModifier[source] ]
fusionScore = clamp(-20, +20, fusionScore)

total_v2 = clamp(0, 100, baseScore_v1 + v1_modifiers + fusionScore)
```

`baseScore_v1 + v1_modifiers` (mevcut trend/adx/rsi/vol/bb/vwap + sweepBonus + regimeBonus + srModifier + oiBonus) **hiç değişmiyor** — `fusionScore` sadece ek bir terim. Gölge modda iken `total_v2` hiçbir yere yazılmaz/kullanılmaz, sadece `score_history`'ye paralel kolon olarak loglanır (bölüm 8'deki paralel geçiş prensibiyle birebir aynı).

### 4.2 Verdict dönüşümü — yeni mantık icat edilmiyor

GO/WAIT/NO kararı **mevcut eşik+histerezis makinesini** (`orchestrator.ts` `applyHysteresis`, `goThreshold` clamp'leri) aynen kullanır; `total_v2` sadece `total`'in yerine geçen bir sayı. Yeni bir karar algoritması, yeni bir eşik mantığı veya ayrı bir "fusion verdict" **tanımlanmıyor** — bu hem karmaşıklığı sınırlar hem de v1 ile v2'nin karşılaştırılmasını (aynı eşik mantığı, farklı girdi) temiz kılar.

### 4.3 Kritik tasarım kuralı — `SR_SCALE_FACTOR` hatası tekrarlanmayacak

Skor motoru denetim raporunda bulunan `SR_SCALE_FACTOR=0.15` ve `HYSTERESIS_MARGIN=4` deseni — kalibre edilmeden koda gömülen, "geçici/placeholder" diye yorumlanıp unutulan sabitler — burada bilinçli olarak önlenecek:

- Tüm `regimeMultiplier` hücreleri **başlangıçta 1.0** ile başlar (rejimin hiçbir farkı olmadığı varsayımı — nötr, iddiasız durum). Hiçbir hücre tahminle/varsayımla dolu bir sayıyla başlamayacak.
- Bir hücre yalnızca, o kaynak-rejim kombinasyonu için `score_history` üzerinde ayrı bir bucket testi (bölüm 4.4'teki yöntemle) yapılıp sonuç net çıktıktan sonra 1.0'dan uzaklaştırılabilir.
- Her değişiklik kod yorumunda hangi ölçümün hangi tarihte hangi sonuçla bu değeri ürettiği yazılı olacak (CLAUDE.md §0.1 madde 2: "bir yorumun iddiası doğrulanmadan gerçek sayılmaz" ilkesiyle uyumlu).

### 4.4 Test edilebilirlik — mevcut hipotez-testi metodolojisinin uzantısı

Yeni bir doğrulama yöntemi icat edilmiyor; skor performansı araştırmasında kullanılan yöntem birebir tekrarlanıyor, iki katmanda:

1. **Bağımsız modifier testi:** Her `rawModifier[source]` tek başına, `regimeMultiplier` uygulanmadan (yani rejimden bağımsız ham hali), kazanan/kaybeden ayırt ediyor mu — Pearson korelasyon + bucket/WR kırılımı (hipotez 1-8 ile aynı format).
2. **Etkileşim testi:** Rejime göre bölünmüş bucket'larda aynı modifier'ın korelasyonu farklılaşıyor mu (örn. OI modifier'ın range'de korelasyonu ≈0 ama trending'de anlamlı mı) — bu, `regimeMultiplier` hücrelerinin kalibrasyon verisi olacak.
3. **Bileşke testi:** `fusionScore`'un tamamı (tüm kaynaklar + kalibre rejim çarpanları birlikte) walk-forward AUC ile ölçülür, bölüm 9'daki başarı kriterleriyle karşılaştırılır.

Her adım `score_history`'ye (zaten kurulu) yazılan ham verilerle, mevcut backtest pooled JSON akışıyla yapılır — yeni bir ölçüm altyapısı gerekmiyor.

### 4.5 Açıklanabilirlik — UI'a yansıma

`ScoreBreakdown`'a (mevcut 8 kategori + `oiBonus` satırı deseni) her `fusionScore` bileşeni ayrı, işaretli bir satır olarak eklenir (`OI: +6.2`, `Funding: -1.0`, `CVD: +3.5`, `Order Book: 0.0` gibi) — tek bir birleşik "AI skoru" değil, kullanıcının her zaman "bu sayı neden bu" sorusunu tek tek her bileşene bakarak cevaplayabildiği, `oiBonus` export'unda zaten kurulan desenin doğrudan devamı.

---

## 5. Data Intelligence Layer — Feature Store & Telemetry

Bu bölüm dış değerlendirmede eklenmesi önerilen bir katman: bugün skora hiç girmeyen ama zaman içinde en değerli sinyal haline gelebilecek ham gözlemlerin, karardan bağımsız olarak biriktirilmesi. Gerekçe: skor performansı araştırmasında CVD gibi kaynakların geriye dönük test edilememesinin tek nedeni verinin hiç kaydedilmemiş olması — bu katman, aynı hatanın yeni kaynaklarla tekrarlanmamasını hedefliyor.

### 5.1 Tasarım ilkesi — mevcut desenin devamı, yeni bir felsefe değil

`score_history` (migration 009) zaten bu prensiple çalışıyor: GO/WAIT/NO fark etmeksizin, her cron döngüsünde tüm pariteler için ham skor+alt-skorlar+regime+overext_flags kaydediliyor — "önce ölç, sonra karar ver" ilkesinin veritabanı karşılığı. Feature Store, bu deseni Signal Fusion'ın 4 yeni ham modifier'ına (`oiModifier`, `fundingModifier`, `cvdModifier`, `obiModifier`) ve rejim etiketine genişletiyor; kavramsal olarak yeni bir sistem değil, aynı tablo ailesinin bir üyesi.

### 5.2 Şema stratejisi — point-in-time doğruluk zorunlu

En kritik kural: Feature Store'a yazılan her satır, **o anda gerçekten hesaplanmış** değeri tutmalı — sonradan yeniden hesaplanmış veya geriye dönük türetilmiş değer YASAK. Bu, `srModifier`/`sweepBonus`'un backtest'e eklenirken uygulanan "look-ahead bias yok" doğrulamasının (`detectSRLevels`/`detectLiquiditySweep`'in canlı motorla birebir aynı two-pass deseni) aynısı — Feature Store'un tüm değeri, ileride "eğer bu özellik o zaman skora dahil olsaydı ne olurdu" sorusunu sahte olmayan bir cevapla yanıtlayabilmesinde. Şema ekleme kuralı da mevcut pratikle aynı: her yeni özellik nullable/opsiyonel kolon olarak eklenir (bu oturumdaki `volRatio`/`trailingReturn30d`/`mfeR` deseni), geçmiş satırlar bozulmaz.

### 5.3 Büyüme kontrolü — Supabase kapasitesi gerçek bir kısıt

Mevcut Supabase projesi 26MB/500MB kullanımda (25 Tem 2026 ölçümü) — bolluk var ama sınırsız değil. Kaynaklar arasında maliyet farkı büyük:
- **Düşük hacimli (OI, Funding, Regime):** saatlik cron kadansında, 9 parite × saatte 1 satır — ayda ~6.500 satır, önemsiz boyut. Sınırsız biriktirilebilir.
- **Yüksek hacimli (CVD, Order Book):** ham trade/derinlik akışı dakikada/saniyede onlarca olay üretebilir — ham haliyle sınırsız biriktirme kısa sürede kotayı zorlar. Bu ikisi için kural: **ham veri sadece kısa bir pencerede** (örn. son 30-90 gün) tam çözünürlükte tutulur, daha eskisi periyodik olarak saatlik/günlük özet satırlara (ortalama, varyans, ekstremler) sıkıştırılır — mevcut VPIN bucket mantığındaki "kapanan bucket'ın ham trade'leri atılır, sadece özet kalır" prensibiyle aynı yaklaşım.
- Rollup işi mevcut hourly cron'un bir uzantısı olarak yapılır, ayrı bir cron gerektirmez (Vercel Hobby 2-cron limiti — bkz. 5.4).

### 5.4 Telemetry pipeline — mevcut cron altyapısına oturma

Vercel Hobby planı 2-cron limitiyle sınırlı (bu kısıt zaten migration 008'de 4 saatlik outcome penceresinin eklenmemesine yol açmıştı) — Feature Store için **yeni bir cron açılmıyor**. Mevcut saatlik `score_history` cron'una ek kolonlar olarak gömülüyor (düşük hacimli kaynaklar) veya mevcut trade-feed ingestion'ının (zaten `lib/orderflow/tradeFeed.ts`'te çalışan ring buffer, VPIN için kurulu) yanına iğnelenen bir yazma adımı olarak eklenir (yüksek hacimli kaynaklar) — yeni bir zamanlanmış görev değil, var olan veri akışının bir dalı.

### 5.5 Analitik erişim — mevcut iş akışına besleme

Feature Store'un tüketicisi bugünkü pooled-JSON + hipotez-testi iş akışının aynısı: SQL export → backtest formatına dönüştürme → korelasyon/bucket/walk-forward testi. Yeni bir analiz aracı kurulmuyor; sadece test edilebilecek değişken sayısı artıyor. Bu, dış değerlendirmenin vurguladığı asıl kazanımı sağlıyor — 6-12 ay sonra "acaba CVD ile fiyat arasında gecikmeli bir ilişki var mı" gibi bugün sorulmayan bir soru, veri zaten biriktiği için hipotez 1-8'deki gibi bir günde test edilebilir hale geliyor; veri toplamadan başlanırsa aynı soru aylarca cevapsız kalır.

### 5.6 Sınır — her şeyi loglama isteğine karşı kural

"İleride işe yarayabilir" gerekçesi sınırsız genişleyebilir ve 5.3'teki depolama riskini büyütür. Kural: bir özellik Feature Store'a girmeden önce iki koşuldan en az birini karşılamalı — (a) zaten Signal Fusion modifier'larından biri (mecburen loglanıyor) veya (b) düşük-maliyetli kaynaklardan (OI/Funding/Regime, saatlik kadans) türetilebiliyor. Yüksek-maliyetli/spekülatif yeni bir ham veri akışı ("belki 8 ay sonra işe yarar" türünden, henüz hiçbir modifier'a bağlı olmayan) Feature Store'a eklenmeden önce ayrı bir onay turu gerektirir — aksi halde `macroScore.ts` örneğindeki gibi (216 satır yazılıp hiç bağlanmamış kod) ölü/kullanılmayan biriktirme riski oluşur.

### 5.7 Yol haritasına yerleşimi

Ayrı bir faz açılmıyor — Feature Store, Phase 1'den itibaren **paralel** inşa ediliyor: Phase 1'de OI/Funding/Regime için şema+kadans kuruluyor (zaten düşük maliyetli, mevcut crona ekleniyor); Phase 2'de CVD ring buffer'ına yazma adımı ekleniyor (bölüm 8, Phase 2 ile aynı anda); Phase 3'te Order Book için rollup stratejisi devreye giriyor (bölüm 8, Phase 3 riskiyle aynı gerekçeyle koşullu — imbalance verisi zaten şüpheli bulunursa ham biriktirme de erteleniyor).

---

## 6. Veri Kaynağı Risk Analizi

| Kaynak | Güvenilir mi? | Tarihsel erişilebilir mi? | Gerçek zamanlı sürdürülebilir mi? |
|---|---|---|---|
| Open Interest | Evet, borsa native | Kısıtlı (birkaç ay) | Evet, ucuz |
| Funding Rate | Evet, borsa native | Evet, iyi (borsa geçmişi kadar) | Evet, ucuz |
| Liquidation Heatmap | **Hayır** — native veri kısıtlı/tahmini kümeler yok, üçüncü parti agregatöre bağımlı | Zayıf | Üçüncü parti API'ye bağımlı, olası ücretli |
| CVD / Delta | Evet (kendi hesaplaman), ama tape'in tam senkron/kayıpsız gelmesi garanti değil | **Hayır** — sadece bundan sonra biriken veriyle var | Evet ama depolama artan maliyet |
| Order Book Imbalance | Evet ama anlık, gürültülü (spoofing riski) | **Hayır** — native arşiv yok | Evet ama en yüksek bant genişliği/depolama maliyeti |
| Market Regime | Evet — mevcut veriden türetiliyor | Evet (zaten backtest'te var — atrPercentile/atrRegime) | Evet, maliyet yok |

---

## 7. Öncelik Matrisi

Puanlama 1 (düşük) – 5 (yüksek), Zorluk ve Maliyet'te düşük puan iyi (kolay/ucuz) anlamına gelir; sıralama Beklenen Katkı yüksek + Zorluk düşük + Maliyet düşük olan üstte.

| Veri Kaynağı | Beklenen Katkı | Zorluk | Maliyet | Öncelik |
|---|---|---|---|---|
| Market Regime Detection (bağlam katmanı) | 3 (dolaylı) | 1 | 1 | **1** |
| Open Interest | 4 | 2 | 1 | **2** |
| Funding Rate (sürekli skor haline getirme) | 3 | 1 | 1 | **3** |
| CVD / Delta | 4 | 2 | 2 | **4** |
| Order Book Imbalance | 3 | 3 | 3 | **5** |
| Liquidation Heatmap | 3 (belirsiz) | 5 | 4 | **6** |

Sıralamanın mantığı: en ucuz ve en hazır altyapıya sahip olanlar (rejim, OI'nin zaten kısmen kurulu olması, funding'in zaten kısmen kalibre olması) önce; native veri kaynağının kendisi belirsiz/dış bağımlı olan (liquidation heatmap) en sona.

---

## 8. Yol Haritası

### Phase 1 — Bağlam katmanı + mevcut gölge sinyallerin aktifleştirilmesi
- **Kapsam:** Market Regime Detection katmanı kurulumu (yeni veri yok, mevcut candle'lardan); `oiVelocityScore`/`oiBonus`'un gölge moddan çıkarılıp gerçek etkinliğinin `score_history` verisiyle ölçülmesi; funding rate'in eşik/blok yerine sürekli bileşene çevrilmesi
- **Süre:** 2-3 hafta (çoğu kod zaten var, asıl iş ölçüm+kalibrasyon)
- **Risk:** Düşük — yeni veri kaynağı yok, sadece mevcut verinin kullanım şekli değişiyor
- **Beklenen kazanım:** Doğrudan WR/AvgR artışı beklenmiyor bu fazda (temel altyapı); asıl kazanım Phase 2'nin ölçülebilir bir zemine oturması

### Phase 2 — Open Interest + CVD entegrasyonu
- **Kapsam:** OI velocity+divergence'ın gerçek skor bileşeni olarak kalibre edilmesi; `lib/orderflow/tradeFeed.ts` üzerine CVD hesaplaması eklenmesi, backtest'e (sadece ileri tarihli veriden) opsiyonel alan olarak export edilmesi
- **Süre:** 4-6 hafta (CVD'nin veri birikmesi zaman alacağı için paralel başlanmalı)
- **Risk:** Orta — CVD backtest'e geriye dönük beslenemiyor, doğrulama forward-test'e bağımlı olacağı için sonuç gecikmeli görülecek
- **Beklenen kazanım:** Hipotez 7'nin (seans) mekanizması muhtemelen burada açıklanabilir hale gelir (ABD seansında OI/order-flow davranışı farklı olabilir) — reddedilen bulgunun nedenini bulma ihtimali

### Phase 3 — Order Book Imbalance + Liquidation (koşullu)
- **Kapsam:** Order book imbalance'ın kısa vadeli filtre olarak denenmesi; liquidation heatmap SADECE Phase 1-2 net bir kazanım gösterirse ve üçüncü parti maliyet/güvenilirlik kabul edilebilirse başlanacak
- **Süre:** 3-4 hafta (liquidation dahilse +2-3 hafta belirsizlik payı)
- **Risk:** Yüksek — hem ufuk uyumsuzluğu (order book çok kısa vadeli) hem liquidation'ın veri kaynağı belirsizliği
- **Beklenen kazanım:** Belirsiz — bu faz veri kaynaklarının kendisi riskli olduğu için, önceki fazların sonucuna göre kapsam daraltılabilir/atlanabilir

---

## 9. Paralel Geçiş

- **v1/v2 birlikte çalışma:** v2 bileşenleri `computeScore()`'a YENİ opsiyonel alanlar olarak eklenir (v1'deki `oiBonus`/`srModifier` deseni tekrarlanır) — v1'in ürettiği GO/WAIT/NO kararı değişmez, v2 katkısı ayrı bir "gölge skor" olarak `score_history`'ye paralel yazılır ama gerçek verdict'i etkilemez, tıpkı `oiDivergenceContrib`'in bugün yaptığı gibi.
- **A/B test nasıl yapılacak:** Gerçek A/B (kullanıcıyı iki gruba bölme) gerekmiyor — tek kullanıcılı/az kullanıcılı bir sistemde bu istatistiksel olarak anlamsız olur. Bunun yerine gölge modda haftalar boyunca hem v1 hem v2 skoru aynı anda hesaplanıp loglanır, sonra geçmişe dönük "v2 dahil olsaydı verdict değişir miydi, değişseydi sonuç daha mı iyi olurdu" analiziyle karşılaştırılır — mevcut backtest+score_history altyapısı bunun için yeterli.
- **Canlı kullanıcı etkilenmeden doğrulama:** Gölge mod prensibi (zaten `oiDivergenceContrib` ile kanıtlanmış desen) — v2 bileşenleri hiçbir zaman gerçek GO/WAIT/NO'yu etkilemez, ta ki `score_history` üzerinde ayrı bir ölçüm turu net bir kazanım gösterene ve kullanıcı açıkça onaylayana kadar (Kural 0 protokolü: skor motoru dosyalarına commit için chat onayı zorunlu).

---

## 10. Başarı Kriterleri

Somut hedefler, mevcut v1 baseline'ına göre:

| Metrik | v1 baseline (mevcut) | v2 minimum hedef |
|---|---|---|
| Walk-forward AUC | ~0.50 (rastgele) | ≥0.58 (hipotez 7'nin 0.55'ini geçmesi gerekiyor, aksi halde v1'den anlamlı fark yok) |
| AvgR | Negatif (-0.13 ile -0.33 arası, teste göre değişken) | Pozitif, ≥+0.05 |
| Profit Factor | Ölçülmedi bu oturumda — Phase 1'de baseline'a eklenmeli | ≥1.3 |
| Win Rate | ~%28 (pooled ortalama) | ≥%35 (mütevazı — WR tek başına yanıltıcı, AvgR/PF ile birlikte değerlendirilmeli) |
| Max Drawdown | Ölçülmedi bu oturumda — Phase 1'de baseline'a eklenmeli | v1'i aşmamalı (aynı veya daha düşük) |

Not: Profit Factor ve Max Drawdown için v1 baseline'ı bu araştırma turunda hiç hesaplanmadı — Phase 1'in bir parçası olarak önce bu boşluk kapatılmalı, yoksa v2'nin "daha iyi" olduğu iddiası referanssız kalır.

---

## 11. Sonuç

En düşük maliyetle en yüksek potansiyeli sağlayan sıra:

1. **Market Regime bağlam katmanı** — sıfır yeni veri maliyeti, mevcut reddedilen hipotezleri (özellikle ATR rejimi ve seans) yeniden değerlendirmenin zeminini kurar
2. **OI'nin gölge moddan çıkarılması** — zaten yazılmış kod, sadece ölçüm ve kalibrasyon eksik; en hızlı potansiyel kazanım
3. **Funding rate'in sürekli bileşene çevrilmesi** — düşük efor, orta katkı, mevcut kalibrasyonun üzerine inşa ediliyor
4. **CVD** — altyapısı hazır ama veri birikmesi zaman alacağı için Phase 2'de paralel başlatılmalı, sonuçları geç görülecek
5. **Order Book Imbalance** — orta öncelik, ufuk uyumu riski nedeniyle önce küçük ölçekte denenmeli
6. **Liquidation Heatmap** — en son, ve koşullu: önceki fazlar net kazanım göstermezse muhtemelen hiç başlanmamalı, çünkü veri kaynağının kendisi (native olmayan, tahmini, dış bağımlı) en zayıf temele sahip

Kısacası: v2'nin ilk iki fazı yeni para/altyapı yatırımı gerektirmiyor — asıl eksik olan, zaten yazılmış ama gölge modda bekleyen kodun (OI) ve zaten kısmen kalibre edilmiş verinin (funding) ölçülüp gerçek skora bağlanması. "Yeni veri kaynağı bulmak" değil, "zaten var olanı doğru kullanmak" en ucuz ve en hızlı kazanım kapısı.
