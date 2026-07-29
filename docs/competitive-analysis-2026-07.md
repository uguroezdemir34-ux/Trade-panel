# QUANTIX OS — Rakip / Pazar Analizi Raporu

**Hazırlanma tarihi:** 2026-07-29 (tüm veriler bu tarih civarında web araması ile toplandı; kaynak linkleri yanında ayrıca not edilmiştir)
**Kapsam:** Kripto trading bot/sinyal platformları, Telegram sinyal grupları, on-chain analitik araçları, forex track-record modeli (Myfxbook), portföy/analiz araçları (Coinigy, Bitsgap)
**Metodoloji notu:** Aşağıdaki veriler WebSearch/WebFetch ile toplanan güncel (çoğunlukla 2026 tarihli) üçüncü taraf inceleme siteleri, Trustpilot özet sonuçları ve resmi kaynaklardan derlenmiştir. Bazı resmi fiyatlandırma sayfaları (3commas.io/pricing, cryptohopper.com/pricing, help.3commas.io, cryptoquant.dev, trustpilot.com) doğrudan erişimde HTTP 403 döndürdüğü için üçüncü taraf inceleme sitelerinden alınan **ikincil** veriler kullanılmıştır — bu noktalar açıkça belirtilmiştir. Hiçbir veri noktası tahmin/uydurma değildir; bulunamayan veriler "kaynak bulunamadı" olarak işaretlenmiştir.

---

## 1. 3Commas

**1. Fiyatlandırma modeli:**
Üç ana katman bildiriliyor ancak kaynaklar arasında rakam çelişkisi var — bu, resmi fiyat sayfasına doğrudan erişilemediği için ikincil kaynaklardan kaynaklanıyor. Bir kaynağa göre Starter $15/ay, Pro $40/ay, Expert $110/ay ([TradeAlgo, 2026](https://www.tradealgo.com/trading-guides/crypto/3commas-review)); başka bir kaynak Pro $29/ay, Expert $49/ay diyor. Ücretsiz deneme mevcut, aylık/yıllık faturalama seçeneği var ([Capterra](https://www.capterra.com/p/10030799/3Commas/), [GetApp](https://www.getapp.com/all-software/a/3commas/)). **Not:** Trustpilot yorumlarında 2026'da bir fiyat yapısı değişikliği yaşandığı, eski $50/ay planların $200/ay muadillerle değiştirildiği ve "%70 indirim" görünümüyle sunulduğu iddia ediliyor ([Trustpilot özet](https://www.trustpilot.com/review/3commas.io)) — kesin güncel rakam resmi kaynaktan doğrulanamadı.

**2. Track record / performans şeffaflığı:**
Kamuya açık, kayıp-dahil filtresiz bir track record sayfası olduğuna dair kaynak bulunamadı. 3Commas kendi blog/inceleme sayfasında müşteri yorumlarını topluyor ([3commas.io/about/reviews](https://3commas.io/about/reviews)) ama bu bağımsız/doğrulanmış bir performans kaydı değil, pazarlama amaçlı review toplama sayfası.

**3. Topluluk/dağıtım kanalı:**
Platform kendisi "Signal Bot" özelliği ile üçüncü taraf sinyal sağlayıcılarına bağlanabiliyor (Pro/Expert planlarda) ama bu QUANTIX'in planladığı gibi merkezi, otomatik Telegram bot bildirimi modeli değil — kullanıcı kendi sinyal kaynağını bağlıyor.

**4. Kullanıcı şikayetleri:**
Trustpilot'ta 4.3/5, 1.754+ yorum ([Trustpilot](https://www.trustpilot.com/review/3commas.io)) ama "eski pozitif yorumlarla yakın zamanlı negatif dalga arasında büyüyen bir ayrışma" olduğu belirtiliyor. Somut alıntılar:
- 4 yıllık bir müşteri fiyat değişikliğini "toplam bir dolandırıcılık" olarak nitelendirdi ("a total scam") — eski $50/ay planların $200/ay'a çıkarıldığını, "%70 indirim"in sahte bir değer izlenimi yarattığını söyledi.
- Kullanıcılar aboneliği iptal etseler bile ücret kesildiğini iddia ediyor (şirket bunu reddediyor).
- Müşteri desteğinin "finansal tavsiye" bahanesini bot kurulumu/performans sorunlarına yardım etmemek için kullandığı iddia ediliyor.
- Sunucuların oynaklık/yüksek hacim anlarında (kullanıcıların en çok ihtiyaç duyduğu an) çevrimdışı kaldığı, kayıt olduklarından beri tekrarlayan kesintiler yaşandığı bildiriliyor.
(Kaynak: [Trustpilot arama özeti](https://www.trustpilot.com/review/3commas.io), erişim 2026-07-29)
ScamAdviser 3commas.io'yu "muhtemelen dolandırıcılık değil, meşru ve güvenilir" olarak değerlendiriyor ([ScamAdviser](https://www.scamadviser.com/check-website/3commas.io)).

**5. Faaliyet süresi / kullanıcı büyüklüğü:**
2017'de Tallinn, Estonya'da kuruldu ([Empirica.io blog](https://empirica.io/blog/3commas-a-technical-review/), [3commas.io/about](https://3commas.io/about)). Kullanıcı sayısında kaynaklar arası büyük fark var: bazı kaynaklar "100.000+ aktif kullanıcı, 18 borsa" diyor, daha yeni (2026) bir kaynak "1 milyon+" diyor — bu rakam şirketin kendi pazarlama materyaline mi dayanıyor yoksa bağımsız mı belirsiz, **kesin/doğrulanmış tek bir rakam olarak alınmamalı**.

**6. Execution:**
**VAR.** 3Commas bir trading bot platformu — DCA, Grid, Options/Futures ve Signal botları borsa API'leri üzerinden otomatik emir gönderiyor (execution yapıyor), sadece sinyal/analiz değil.

---

## 2. Cryptohopper

**1. Fiyatlandırma modeli:**
4 katman: Pioneer (Ücretsiz, 1 borsa bağlantısı, temel özellikler), Explorer (~$24.16/ay, 80 pozisyona kadar, 2 borsa), Adventurer (~$57.5/ay, sınırsız pozisyon, 5 borsa, gelişmiş TA), Hero (~$107.5/ay, copy trading, sınırsız borsa, öncelikli destek) ([xpay.sh pricing özeti, 2026](https://www.xpay.sh/saas-pricing/cryptohopper/)). Ek not: temel abonelik toplam maliyet değil — sinyal abonelikleri ve premium marketplace şablonları ayrı ücretli.

**2. Track record / performans şeffaflığı:**
Cryptohopper Marketplace'te sinyal sağlayıcıları için "Performance Statistics" güncellemesi yapıldı — sağlayıcılar performanslarını 17 büyük borsada (Binance, Coinbase, Crypto.com dahil) takip edebiliyor, kullanıcı abone olmadan önce geçmiş performans verisi ve kullanıcı puanlarını görebiliyor ([Cryptohopper resmi blog / PRWeb duyurusu, 2026](https://www.prweb.com/releases/cryptohopper-updates-crypto-trading-signal-stats-in-marketplace-302294062.html)). Ancak bu istatistiklerin **kayıp dahil filtresiz** mi yoksa sağlayıcı tarafından seçilebilir/manipüle edilebilir mi olduğu net değil — platform kullanıcılara "sağlayıcının kanıtlanmış bir track record'u olup olmadığını bağımsız doğrulamalarını" öneriyor, yani platformun kendisi tam bağımsız doğrulama garantisi vermiyor.

**3. Topluluk/dağıtım kanalı:**
Marketplace modeli üzerinden üçüncü taraf sinyal sağlayıcıları abonelik satıyor; Telegram/Discord entegrasyonu bildirim kanalı olarak kullanılabiliyor ama merkezi/resmi bir "tüm sonuçlar otomatik Telegram'a düşer" modeli olduğuna dair kaynak bulunamadı.

**4. Kullanıcı şikayetleri:**
Trustpilot 3.8/5, dağılım kutuplaşmış: %59 beş yıldız, %25 tek yıldız ([arama özeti, Trustpilot](https://www.trustpilot.com/review/cryptohopper.com)). Somut şikayetler:
- Trading'in etkinleştirilemediği, hiç işlem gerçekleşmediği bildiriliyor.
- Sinyallerin güvenilmez olduğu şikayeti var.
- Bir kullanıcı 6 ay kullanıp bir strateji satın aldığını, ne platformun ne stratejinin kâr getirmediğini, platformu "dolandırıcılık" olarak nitelendirdiğini belirtti.
- Bir kullanıcı çalışmayan uygulama için $165 ücretlendirildiğini, destekle 3 gün uğraştığını, geri ödeme alamadığını bildirdi.
- Yüksek abonelik maliyeti şikayeti tekrarlanıyor.
(Kaynak: [Trustpilot arama özeti](https://www.trustpilot.com/review/cryptohopper.com), erişim 2026-07-29; not: Trustpilot'a doğrudan WebFetch erişimi 403 ile engellendi, veri arama motoru özetinden alındı)
Pozitif yönler: kullanım kolaylığı, geniş borsa entegrasyonu, eğitim kaynakları.

**5. Faaliyet süresi / kullanıcı büyüklüğü:**
2017'de kuruldu, merkezi Amsterdam, Hollanda ([LeadIQ](https://leadiq.com/c/cryptohopper/5c6c324c1f0000da0eb4d129), [HighPerformr](https://www.highperformr.ai/company/cryptohopper)). Şubat 2019'da 100.000 kullanıcıya ulaştığı bildiriliyor — **daha güncel bir kullanıcı rakamı kaynaklarda bulunamadı**. 2024 itibarıyla ~33 çalışan.

**6. Execution:**
**VAR.** Cryptohopper bulut tabanlı trading bot platformu — borsa API'leri üzerinden otomatik alım/satım (execution) yapıyor.

---

## 3. TradingView — Pine Script / Strategy Marketplace

**1. Fiyatlandırma modeli:**
TradingView'in kendisi ayrı abonelik katmanları sunuyor (temel grafik/analiz aracı); strateji/indikatör "marketplace"i ise çoğunlukla bireysel yazarların kendi fiyatlarını belirlediği, invite-only script aboneliklerinden oluşuyor — merkezi tek bir "marketplace fiyatı" yok, yazar başına değişiyor. Kesin bir fiyat aralığı için kaynak bulunamadı (çok değişken).

**2. Track record / performans şeffaflığı:**
TradingView'in yayın kuralları katı: stratejilerin "repaint" yapmaması, performansı yapay şekilde şişirecek teknikler içermemesi gerekiyor; "caution" (dikkat) statüsündeki stratejiler yayınlanamıyor; tüm geçmiş/potansiyel performans, sinyal doğruluğu, istatistiksel güvenilirlik iddialarının açıkça kanıtlanması şart ([TradingView Strategy publishing rules](https://www.tradingview.com/support/solutions/43000764681-strategy-publishing-rules/)). Strateji raporlarının anlamlı olması için ideal olarak 100+ işlem içermesi öneriliyor, Strategy Tester'daki uyarıların yayından önce çözülmesi gerekiyor ([TradingView Pine docs](https://www.tradingview.com/pine-script-docs/writing/publishing/)). Bu, **backtest/simülasyon şeffaflığı** için güçlü bir kural seti — ama gerçek/canlı, kayıp-dahil bir "track record" garantisi değil; asıl kontrol backtest raporunun dürüstlüğü üzerine.

**3. Topluluk/dağıtım kanalı:**
Kendi platformu üzerinden (chart yorumları, yayınlanan script sayfaları) organik dağıtım; merkezi Telegram/Discord bot bildirimi yok — bireysel "vendor"lar kendi kanallarını (genelde Telegram) ayrıca kurabiliyor.

**4. Kullanıcı şikayetleri:**
Doğrudan "TradingView marketplace" şikayetlerinden çok, platform üzerinde barınan **üçüncü taraf dolandırıcı sinyal satıcıları** ile ilgili uyarılar öne çıkıyor: TradingView'in kendisi "sahte YouTube kanalları", "sahte reklamlar" ve kayıp sonrası "yatırım tavsiyesi" satan dolandırıcılar konusunda kullanıcı uyarı blog yazıları yayınlamış ([TradingView blog](https://www.tradingview.com/blog/en/tradingview-tackles-the-spam-issue-12583), [TradingView blog - sahte reklamlar](https://www.tradingview.com/blog/en/protect-yourself-from-fake-tradingview-ads-53402)). Yaygın şikayet teması: sinyal servislerinin performans göstermediği, abonelerin risk toleransı/hesap büyüklüğünü dikkate almadığı; sahtekarların yüksek kazanç oranı iddialarıyla ve lüks yaşam görselleriyle kandırdığı.

**5. Faaliyet süresi / kullanıcı büyüklüğü:**
TradingView'in kendisi için kesin kuruluş yılı/kullanıcı rakamı bu araştırmada hedeflenmedi (platform kendisi rakip değil, marketplace modeli inceleniyor) — **spesifik marketplace kullanıcı sayısı kaynaklarda bulunamadı**.

**6. Execution:**
**KISMEN VAR — ama sinyal/strateji marketplace'i üzerinden değil.** TradingView, desteklenen brokerlarla (OANDA, AMP Futures, TD Ameritrade gibi sınırlı sayıda regüle broker) doğrudan entegrasyon sunuyor, grafikten emir gönderilebiliyor ([ForexBrokers.com](https://www.forexbrokers.com/guides/tradingview-brokers)). Ancak Pine Script strateji/indikatör yazarlarının sattığı "sinyal" ürünleri kendi başına execution yapmıyor — kullanıcı ayrıca bir broker bağlamalı veya manuel işlem açmalı.

---

## 4. Myfxbook (model referansı — forex)

**1. Fiyatlandırma modeli:**
Temel platform **tamamen ücretsiz** — şirket reklam gelirinden kazanıyor, analitik ve hesap takibi için kullanıcıya ücret yok ([arama özeti](https://www.myfxbook.com/about)). AutoTrade (copy trading) hizmeti bazı broker/kurulumlarda ek ücrete tabi olabilir ama temel model ücretsiz.

**2. Track record / performans şeffaflığı — QUANTIX için EN İLGİLİ MODEL:**
Myfxbook, kullanıcının brokerından **salt-okunur (investor password) erişimle** doğrudan bağlanıp hesabın gerçek trade geçmişini, açık/kapalı pozisyonları, bakiye/özkaynak ve performans istatistiklerini **otomatik ve manipüle edilemez şekilde** kaydediyor ([arama özeti](https://help.valerytrading.com/article/wquery/verified-track-records-myfxbook-/article_id-pjcxbwcs-195130)). "Track record verified" yeşil tik, brokerdan gelen veri ile hesap sahibinin gösterdiği verinin eşleştiğini onaylıyor. AutoTrade sağlayıcıları için tarama kriterleri var: en az 3 aylık işlem geçmişi, kanıtlanmış track record, maksimum %50 drawdown, en az 100 işlem ([arama özeti](https://www.fpmarkets.com/myfxbook/)).
**Önemli çekince:** Birden fazla kaynak, brokerların/hesapların sahte olabileceğini, myfxbook istatistiklerinin manipüle edilebileceğini uyarıyor — "Myfxbook istatistiklerine dikkatli yaklaşın, manipüle edilebilirler" başlıklı bir ForexFactory tartışması var ([ForexFactory thread](https://www.forexfactory.com/thread/588456-be-cautious-of-myfxbook-stats-they-can-be?page=2)). Yani "otomatik broker-doğrulamalı" olması bile %100 sahtecilik-geçirmez değil (sahte broker/demo hesap riski var).

**3. Topluluk/dağıtım kanalı:**
Kendi web sitesi + forex topluluk forumu üzerinden; Telegram/Discord bot bildirimi Myfxbook'un kendi ürünü değil (bazı üçüncü taraf sinyal sağlayıcıları kendi Telegram kanallarını Myfxbook linkiyle birlikte pazarlıyor).

**4. Kullanıcı şikayetleri:**
Trustpilot ve Sitejabber'da karışık yorumlar. Sitejabber'da 3 yorumdan 1.3/5 (küçük örneklem, dikkatli yorumlanmalı) ([Sitejabber](https://www.sitejabber.com/reviews/myfxbook.com)). Şikayetler: canlı güncellemenin (ücretli özellik) kesintili olması, kötü destek, birden fazla hesap için ücretlendirmede tutarsızlık, bazı kullanıcıların "platformun dolandırıcıları koruduğunu" iddia etmesi (ForexFactory/forum tartışmaları). ScamAdviser myfxbook.com'u meşru/güvenli olarak değerlendiriyor.

**5. Faaliyet süresi / kullanıcı büyüklüğü:**
2008 (bazı kaynaklara göre 2009) kuruldu, merkezi Basingstoke, Birleşik Krallık ([Tracxn](https://tracxn.com/d/companies/myfxbook/__s4Bjnp9uUlqhGVdlZxuZNPAVUMarF4DlzyC445QIP-M)). 100+ broker'ın müşterilerini bağlıyor, "binlerce" kullanıcı deniyor ama **kesin bir kullanıcı/abone rakamı bulunamadı**.

**6. Execution:**
**KISMEN VAR (AutoTrade özelliğiyle).** Temel Myfxbook analitik/track-record aracı execution yapmıyor (pasif izleme). Ama "AutoTrade" adlı ayrı bir copy-trading modülü, seçilen bir sağlayıcının pozisyonlarını kullanıcının kendi hesabında otomatik olarak ayna gibi açıyor (gerçek execution).

---

## 5. Telegram/Discord Kripto Sinyal Grupları (örnekler: Wolfx Signals, Learn2Trade, Binance Killers, Fat Pig Signals)

**1. Fiyatlandırma modeli:**
Genellikle freemium: ücretsiz kanal (gecikmeli/sınırlı sinyal) + VIP/ücretli katman. Örnek: Wolfx Signals — 135.000+ ücretsiz abone, 2.000+ VIP üye ([arama özeti çoklu inceleme sitesi](https://primexbt.com/for-traders/20-best-crypto-signals-telegram-groups/)); Learn2Trade — ücretsiz katman haftada 3 sinyal, premium planlar daha fazlası için. **Not:** Bu rakamlar bağımsız üçüncü taraf "best-of" listesi/inceleme sitelerinden geliyor, çoğu bu tür sitelerin kendisi de affiliate gelir modeliyle çalışıyor — objektiflik sınırlı olabilir.

**2. Track record / performans şeffaflığı:**
**Yapısal olarak zayıf nokta.** Wolfx "%98 doğruluk" gibi iddialar öne sürüyor ama bu iddiaların bağımsız doğrulaması olduğuna dair kaynak bulunamadı. Learn2Trade "%79 başarı oranı" bildiriyor, yine bağımsız doğrulama kaynağı yok. Genel endüstri deseni (birden fazla inceleme kaynağında tekrarlanan): büyük gruplar (10.000+ abone) bazen üyeleri coin pump etmek için kullanıyor, sadece kârlı sinyalleri öne çıkarıyor, stop-loss'ları nadiren açıklıyor ([arama özeti](https://www.yahoo.com/news/articles/chinese-groups-transformed-telegram-dark-183000801.html) ve ilgili inceleme siteleri). Bazı gruplar sinyalleri ücretli kanalda geç paylaşıyor veya başka kanallardan kopyala-yapıştır yapıp kullanıcıları zarara sokuyor.

**3. Topluluk/dağıtım kanalı:**
Doğrudan Telegram; bazıları (Wolfx dahil) Cornix gibi üçüncü taraf bot entegrasyonuyla **yarı-otomatik execution** sunuyor — sinyal Telegram'a düşüyor, kullanıcı Cornix botunu bağlarsa otomatik olarak borsada işlem açılıyor.

**4. Kullanıcı şikayetleri:**
- Learn2Trade: Trustpilot ve forum şikayetlerinde "otomatik abonelik yenileme", kötü müşteri hizmeti, vaat edilen sinyallerin gelmemesi, 30 günlük para iade garantisine rağmen iade taleplerine yanıt alınamaması bildiriliyor ([ForexFraud değerlendirmesi](https://forexfraud.com/scam-assessments/is-learn2trade-signals-service-safe/), [Scam Detector](https://www.scam-detector.com/validator/learn2trade-com-review/) — orta güven skoru 51/100 veriyor).
- California Department of Financial Protection and Innovation (DFPI) resmi dolandırıcılık takip kaydında somut bir vaka: "SB Signal Sniper" adlı bir Telegram grubunda "Professor" ve "Assistant" rolündeki kişiler kârlı sinyal vaat etmiş, kurban sahte platforma para yatırıp sinyalleri takip etmiş, para çekmeye çalışınca "madencilik ücreti" ve ardından ek $3.000 "işlem gücü" ücreti talep edilmiş, kurban en az $6.000 kaybetmiş ([DFPI Crypto Scam Tracker, resmi ABD eyalet kaynağı](https://dfpi.ca.gov/consumers/crypto/crypto-scam-tracker/coingrocer-net-chat-page-fraudulent-platform/) türü kayıtlar). Bu, "sinyal grubu" etiketi altında yapılan doğrudan dolandırıcılık vakası — QUANTIX'in modeliyle karıştırılmamalı ama pazarın güven açığının somut kanıtı.
- Geniş ölçekte: Çin merkezli Telegram ağlarının "dünyanın en büyük yasadışı kripto ekonomisinin" omurgası haline geldiği, "pig-butchering" dolandırıcılık endüstrisinin ABD'li kurbanlardan yıllık ~10 milyar dolar ürettiği bildiriliyor ([Yahoo/Bloomberg türevi haber özeti](https://www.yahoo.com/news/articles/chinese-groups-transformed-telegram-dark-183000801.html)).

**5. Faaliyet süresi / kullanıcı büyüklüğü:**
Wolfx: COVID döneminde (2020 civarı) İspanya'da kuruldu, 135.000+ ücretsiz + 2.000+ VIP abone (kaynak: üçüncü taraf "best-of" listesi, bağımsız doğrulama yok). Learn2Trade: Birleşik Krallık merkezli, kesin kuruluş yılı bu aramada bulunamadı. Genel olarak bu segmentte **doğrulanmış, bağımsız kullanıcı rakamı bulmak neredeyse imkansız** — çoğu rakam grubun kendi Telegram üye sayacından, gerçek aktif/ödeme yapan abone sayısını yansıtmıyor olabilir.

**6. Execution:**
**Genelde YOK (saf sinyal) — bazıları Cornix gibi üçüncü taraf botlarla İSTEĞE BAĞLI execution sunuyor.** Varsayılan model: manuel, kullanıcı sinyali okuyup kendi eliyle işlem açıyor. Cornix/3Commas gibi bir bot bağlanırsa yarı-otomatik hale geliyor.

---

## 6. CryptoQuant (on-chain analitik)

**1. Fiyatlandırma modeli:**
Free, Professional, Enterprise olmak üzere 3 katman bildiriliyor ([SourceForge/G2 türevi özet](https://sourceforge.net/software/product/CryptoQuant/)) ama **kesin dolar rakamları resmi kaynaktan doğrulanamadı** (cryptoquant.dev/resource/pricing sayfasına WebFetch erişimi 403 ile engellendi).

**2. Track record / performans şeffaflığı:**
Farklı segment — CryptoQuant bir "sinyal/trade tavsiyesi" ürünü değil, ham/işlenmiş on-chain veri + gösterge sağlayıcısı. "Track record" kavramı doğrudan uygulanmıyor; buradaki güvenilirlik sorusu "veri doğruluğu/metodoloji şeffaflığı" ile ilgili, kazanç/kayıp performansıyla değil. Bu nedenle QUANTIX ile doğrudan kıyaslanabilir bir "track record şeffaflığı" verisi yok.

**3. Topluluk/dağıtım kanalı:**
Web platformu + API; kurucu Ki Young Ju'nun aktif X/Twitter varlığı üzerinden dağıtım/marka güveni inşası öne çıkıyor (kaynak: genel bilgi, bu oturumda doğrudan doğrulanmadı).

**4. Kullanıcı şikayetleri:**
Bu araştırmada spesifik, alıntılanabilir kullanıcı şikayeti bulunamadı — CryptoQuant için ayrı bir şikayet taraması yapılmadı (kapsam dışına düştü, zaman/öncelik nedeniyle).

**5. Faaliyet süresi / kullanıcı büyüklüğü:**
2018'de Güney Kore'de Ki Young Ju tarafından kuruldu ([CBInsights](https://www.cbinsights.com/company/cryptoquant), [CryptoSlate](https://cryptoslate.com/companies/cryptoquant/)). "Milyonlarca kripto yatırımcısına hizmet veriyor" deniyor ama bu genel/doğrulanmamış bir pazarlama ifadesi — **kesin kullanıcı rakamı bulunamadı**.

**6. Execution:** **YOK.** Saf veri/analitik ürünü, sinyal veya execution sunmuyor.

---

## 7. Glassnode (on-chain analitik)

**1. Fiyatlandırma modeli:**
Studio katmanları: Standard $0 (ücretsiz), Advanced ~$49–99/ay, Professional ~$999/ay (yıllık faturalamada) ([CaptainAltcoin](https://captainaltcoin.com/glassnode-review/), [comparedge.com](https://comparedge.com/tools/glassnode)). API erişimi Professional plana ek özellik olarak dahil. Kesin güncel rakamlar resmi glassnode.com fiyat sayfasından teyit edilemedi (bu oturumda doğrudan fetch denenmedi, ikincil kaynaklardan alındı).

**2. Track record / performans şeffaflığı:**
CryptoQuant ile aynı kategori — sinyal/trade tavsiyesi değil, veri/metrik sağlayıcısı. Doğrudan "track record" kavramı uygulanmıyor.

**3. Topluluk/dağıtım kanalı:**
Web platformu (Studio) + API; kurumsal/fon müşterilerine odaklı.

**4. Kullanıcı şikayetleri:**
Bu araştırmada spesifik şikayet taraması yapılmadı (kapsam dışı bırakıldı, düşük öncelik — segment farklı).

**5. Faaliyet süresi / kullanıcı büyüklüğü:**
Kuruluş yılı kaynaklar arasında çelişkili: bazı kaynaklar 2017, bazıları 2018 diyor; İsviçre'nin Baar kasabasında kurulu ([CryptoSlate](https://cryptoslate.com/companies/glassnode/), [CBInsights](https://www.cbinsights.com/company/glassnode)). Kesin kullanıcı rakamı bulunamadı.

**6. Execution:** **YOK.** Saf on-chain veri/analitik platformu.

---

## 8. Coinigy

**1. Fiyatlandırma modeli:**
Aylık ~$18.66'dan başlıyor ([arama özeti, çoklu inceleme sitesi](https://www.bitdegree.org/crypto/coinigy-review)). Tam katman yapısı ve üst sınır fiyatı için resmi sayfa erişilemedi.

**2. Track record / performans şeffaflığı:**
Coinigy bir sinyal/tavsiye ürünü değil — çoklu borsa terminal + grafik + portföy takibi + fiyat alarmı aracı. Track record/performans iddiası yapmıyor, bu nedenle QUANTIX ile bu eksende doğrudan kıyaslanamaz.

**3. Topluluk/dağıtım kanalı:**
Kendi web/masaüstü platformu; özel bir Telegram/Discord bildirim modeli öne çıkmıyor.

**4. Kullanıcı şikayetleri:**
Genel olarak "güvenilir" değerlendiriliyor ama şikayetler: pahalı abonelik, öğrenme eğrisi, güncel olmayan mobil uygulama, bazı popüler borsaların (Bitget, MEXC) desteklenmemesi ([arama özeti](https://westafricatradehub.com/reviews/coinigy/)).

**5. Faaliyet süresi / kullanıcı büyüklüğü:**
2014'te Milwaukee, ABD'de Robert Borden ve William Kehl tarafından kuruldu. İlk 2 yılda ~80.000 kullanıcıya ulaştığı, bunların ~%25'inin ücretli plana geçtiği bildiriliyor ([arama özeti, Tracxn/blockspot türevi](https://tracxn.com/d/companies/coinigy/__6ntrkUSYY4uHe0WR4N1D6W4E-qSdG-MSopGlF3yMxgY)) — **bu rakam 2016 civarına ait, güncel (2026) kullanıcı sayısı bulunamadı**.

**6. Execution:**
**KISMEN VAR.** Coinigy bir "unified trading terminal" — API bağlantısıyla borsalarda manuel/yarı-otomatik emir gönderme imkanı sunuyor, ama 3Commas/Cryptohopper/Bitsgap gibi özel "bot" (DCA/Grid/Arbitraj) motoru öne çıkan bir özellik olarak bulunamadı; ürün esas olarak grafik+portföy+terminal odaklı.

---

## 9. Bitsgap

**1. Fiyatlandırma modeli:**
Aylık ~$29'dan başlıyor, ücretsiz katman dahil 4 plan ([arama özeti, Capterra](https://www.capterra.com/p/10004220/Bitsgap/)).

**2. Track record / performans şeffaflığı:**
Kamuya açık, bağımsız doğrulanmış bir track record sayfası olduğuna dair kaynak bulunamadı — bot geçmiş performansı muhtemelen kullanıcının kendi hesap panelinde görünüyor (özel), pazar/rakip karşılaştırması için kamuya açık şeffaflık verisi bulunamadı.

**3. Topluluk/dağıtım kanalı:**
Kendi platformu; özel bir merkezi Telegram bot bildirim modeli öne çıkmıyor.

**4. Kullanıcı şikayetleri:**
Genel olarak pozitif (Reddit/Trustpilot), arayüz basitliği ve destek hızı övülüyor. Şikayetler: fiyatlandırma — 3Commas, TradeSanta, Shrimpy gibi benzer ürünlerin çoğu zaman daha ucuza aynı işlevi sunduğu belirtiliyor; bazı kullanıcılar yavaş destek yanıtı, tutarsız sorun çözümü, faturalama/iade sorunları bildiriyor ([arama özeti](https://cryptoadventure.com/bitsgap-review-2026-grid-and-dca-bots-pricing-security-and-fit/)).

**5. Faaliyet süresi / kullanıcı büyüklüğü:**
2017'de kuruldu ([arama özeti, coinpedia](https://app.coinpedia.org/company/bitsgap/)). Kesin kullanıcı rakamı bulunamadı.

**6. Execution:**
**VAR.** Grid/DCA/Futures botları + arbitraj motoru ile 17+ borsada otomatik emir gönderiyor (execution yapıyor).

---

## Karşılaştırma Tablosu

| Ürün | Fiyat aralığı (aylık) | Track record şeffaflığı | Topluluk modeli | Execution |
|---|---|---|---|---|
| **3Commas** | ~$15–$110 (kaynaklar çelişkili, bkz. §1) | Kamuya açık/bağımsız track record yok; kendi review sayfası pazarlama amaçlı | Kullanıcı 3. taraf sinyal botu bağlayabiliyor; merkezi Telegram modeli yok | **Var** (DCA/Grid/Options/Signal botları) |
| **Cryptohopper** | Ücretsiz–~$107.5 (4 katman) | Marketplace'te sağlayıcı performans istatistiği var ama kayıp-dahil/filtresiz garantisi net değil, "kendin doğrula" uyarısı var | Marketplace + bazı Telegram/Discord entegrasyonu, merkezi otomatik bildirim değil | **Var** (bulut bot) |
| **TradingView (Strategy/Signal marketplace)** | Yazar başına değişken, merkezi fiyat yok | Backtest/yayın kuralları katı (repaint yasağı, 100+ işlem önerisi) ama canlı/kayıp-dahil track record garantisi yok; 3. taraf dolandırıcı satıcı riski yüksek | Yazar bazlı, çoğunlukla platform dışı (kendi Telegram vb.) | **Kısmen** (sınırlı sayıda regüle broker entegrasyonu, sinyal ürünü kendisi execution yapmıyor) |
| **Myfxbook** | Ücretsiz (AutoTrade bazı kurulumlarda ek ücretli) | **En güçlü model** — broker-doğrulamalı, salt-okunur bağlantı, "verified" rozeti; yine de sahte broker/demo hesap riski uyarısı var | Kendi forum/topluluk sitesi; merkezi Telegram bot değil | **Kısmen** (AutoTrade modülüyle) |
| **Telegram sinyal grupları (Wolfx, Learn2Trade, vb.)** | Ücretsiz katman + VIP (rakamlar kaynağa göre değişken) | **En zayıf nokta** — doğrulanmamış "%98 doğruluk" gibi iddialar, seçici gösterim riski yaygın örüntü olarak bildiriliyor | Telegram/Discord birincil kanal, bazıları Cornix ile yarı-otomatik | **Kısmen** (Cornix gibi 3. parti bot bağlanırsa) |
| **CryptoQuant** | Free/Professional/Enterprise (kesin rakam bulunamadı) | Uygulanamaz (veri sağlayıcı, sinyal değil) | Web + API | **Yok** |
| **Glassnode** | Free/~$49–99/~$999 (Studio) | Uygulanamaz (veri sağlayıcı) | Web + API | **Yok** |
| **Coinigy** | ~$18.66'dan başlıyor | Uygulanamaz (terminal/portföy aracı) | Web/masaüstü | **Kısmen** (manuel/API terminal, özel bot motoru değil) |
| **Bitsgap** | ~$29'dan başlıyor, ücretsiz katman var | Kamuya açık bağımsız track record bulunamadı | Web platformu | **Var** (Grid/DCA/Futures/Arbitraj botları) |

---

## Track Record Şeffaflığında En İyi Uygulama Örnekleri

**Myfxbook — en yakın model, ama QUANTIX'in planından farklı bir eksende güçlü:**
Myfxbook'un gücü "broker-doğrulamalı, salt-okunur, otomatik senkronize" veri olması — kullanıcı ya da sağlayıcı istese de sayıları manuel değiştiremiyor, çünkü veri doğrudan broker sunucusundan çekiliyor. Bu, QUANTIX'in planladığı "kayıp dahil filtresiz" ilkesiyle **ruh olarak aynı yönde** ama farklı bir mekanizma: Myfxbook'ta güvenilirlik "kaynağın manipüle edilemezliğinden", QUANTIX'te planlanan güvenilirlik "yayıncının editoryal seçmemesinden (filtresizlik ilkesi)" geliyor. QUANTIX bir execution platformu olmadığı için (kullanıcı emri kendi eliyle açıyor) Myfxbook'un "broker senkronizasyonu" modelini birebir kopyalayamaz — QUANTIX'in kayıt ettiği "GO sinyali" ile kullanıcının gerçekte ne yaptığı arasında doğal bir kopukluk var (Myfxbook'ta bu kopukluk yok, çünkü gerçek hesap verisi çekiliyor). Bu, QUANTIX'in şeffaflık iddiasının sınırını dürüstçe belirtmesi gereken bir nokta: "sinyal ürettik, kullanıcı böyle yaptı mı bilmiyoruz" ile "kullanıcı gerçekten böyle yaptı, kanıtlı" arasında fark var.

**Cryptohopper Marketplace — kısmi model:**
Sağlayıcı bazlı performans istatistiği kamuya açık ve abone olmadan görülebiliyor, bu iyi bir adım. Ancak platform kendisi "bağımsız doğrula" uyarısı yaparak sorumluluğu kullanıcıya devrediyor — yani platformun kendisi verinin doğruluğunu garanti etmiyor. QUANTIX'in planı burada daha ileri gidiyor: kayıpları da **filtresiz** göstermeyi taahhüt ediyor, Cryptohopper'da böyle bir taahhüt bulunamadı.

**TradingView — backtest şeffaflığında güçlü, canlı performansta zayıf:**
Yayın kuralları (repaint yasağı, minimum işlem sayısı, varsayılan ayarların açıklanması) backtest/simülasyon seviyesinde ciddi bir disiplin dayatıyor. Ama bu kural seti geçmişe dönük simülasyona odaklı — canlı, ileri-yönlü (forward), kayıp dahil bir sonuç kaydı garantisi sağlamıyor. QUANTIX'in "otomatik Telegram bot bildirimi" modeli tam olarak bu boşluğu dolduruyor: her GO sinyali anında, editoryal müdahale olmadan kayda geçiyor.

**3Commas, Bitsgap, Telegram sinyal grupları — kamuya açık bağımsız track record örneği bulunamadı.** Bu üç kategori QUANTIX'in planladığı modelin **doğrudan rakip örneği olmadığını**, aksine bu üç kategoride yaygın olan güven açığının (özellikle Telegram sinyal gruplarında) QUANTIX'in farklılaşma fırsatının kaynağı olduğunu gösteriyor.

---

## Pazardaki Boşluklar / Fırsatlar — Dürüst Değerlendirme

**Güçlü yanlar (gerçek bir farklılaşma potansiyeli var):**
1. Telegram sinyal grubu segmentinde (Wolfx, Learn2Trade ve benzerleri) **hiçbirinde kamuya açık, kayıp-dahil, filtresiz, otomatik bir track record** bulunamadı — bu araştırmada net bir kanıt yok. Seçici gösterim ("sadece kazananları paylaş") yaygın bir şikayet teması olarak defalarca çıktı. QUANTIX bu spesifik boşlukta gerçek bir konumlandırma avantajına sahip olabilir.
2. "Otomatik Telegram bot bildirimi" (editoryal müdahale olmadan her sinyalin anında loglanması) — hiçbir incelenen rakipte bu spesifik kombinasyon (kamuya açık + kayıp dahil + otomatik + Telegram) birebir bulunamadı. Cryptohopper'ın marketplace istatistikleri en yakın örnek ama "otomatik doğrulama" garantisi sunmuyor.
3. Myfxbook modelinin forex'te 15+ yıldır çalışıyor olması ("track record verified" konsepti), kripto tarafında bu disiplinin kripto sinyal gruplarına henüz taşınmadığını gösteriyor — bu bir pazar boşluğu sinyali olabilir.

**Zayıf yanlar / riskler (abartısız değerlendirme):**
1. **QUANTIX execution yapmıyor** — bu hem bir güvenlik/uyumluluk avantajı hem de şeffaflık iddiasının doğal bir sınırı. Myfxbook'un gücü "gerçek hesap verisi" çekmesinden geliyor; QUANTIX sinyal üretiyor ama kullanıcının gerçekte ne yaptığını (pozisyon açtı mı, ne büyüklükte, ne zaman kapattı) doğrulayamıyor. "Kayıp dahil filtresiz" iddiası sadece **sinyal doğruluğu** için geçerli olabilir, **kullanıcı sonucu** için değil — bu ayrımın pazarlamada net yapılması gerekiyor, yoksa "track record" iddiası yanıltıcı okunabilir (ör. Myfxbook ile aynı kalitede kanıt sunduğu izlenimi yaratmamalı).
2. "Şeffaflık önce, pazarlama sonra" stratejisi zaman gerektirir — rakiplerin çoğu (Cryptohopper, 3Commas, Telegram grupları) zaten yıllardır pazarda, kurulu kullanıcı tabanına ve marka bilinirliğine sahip. Şeffaflık tek başına hızlı büyüme garantisi değil; Myfxbook 15+ yıldır var ve hâlâ "sahte broker/manipüle edilebilir istatistik" eleştirisi alıyor — yani mükemmel şeffaflık modeli bile şüpheciliği tamamen ortadan kaldırmıyor.
3. Küçük örneklem riski: Yeni bir track record sayfası başlangıçta az veri içerecek (kısa süre, az sinyal) — bu dönemde "filtresiz" olmak aslında kısa vadede kötü sonuçları da göstermek anlamına gelebilir, bu da erken aşamada güven inşa etmek yerine güveni zedeleyebilir eğer erken dönem performansı zayıfsa. Bu risk kabul edilmeli, "şeffaflık her zaman kısa vadede avantajlıdır" varsayımı yapılmamalı.
4. Rekabetin çoğu (CryptoQuant, Glassnode, TradingView marketplace, Myfxbook) farklı segmentlerde (veri sağlayıcı, backtest platformu, forex) — bunlar QUANTIX'in doğrudan rakibi değil, model referansı. **Gerçek doğrudan rakipler** (kripto sinyal/analiz + Telegram dağıtım) esasen Cryptohopper marketplace sağlayıcıları ve Telegram sinyal gruplarıdır — bu daha dar segmentte QUANTIX'in konumu değerlendirilmeli, geniş "trading araçları" pazarıyla karıştırılmamalı.
5. Regülasyon riski (aşağıda ayrı bölümde) şeffaflık stratejisiyle doğrudan çelişmiyor ama "performans iddiası yayınlamak" bazı yargı alanlarında ek yükümlülük getirebilir — bu stratejik avantajın hukuki maliyeti olabileceği unutulmamalı.

**Sonuç:** Planlanan yaklaşım (kayıp dahil filtresiz + otomatik Telegram bot bildirimi) bu araştırmada incelenen rakiplerin hiçbirinde birebir bulunamadı — bu gerçek bir farklılaşma potansiyeli. Ama bu üstünlük (a) sadece "sinyal doğruluğu" seviyesinde kanıt sunar, "kullanıcı sonucu" seviyesinde değil (execution yapılmadığı için), (b) tek başına büyüme garantisi değildir, (c) erken dönem küçük örneklem riski taşır. Abartısız çerçevede: **niş bir konumlandırma avantajı, çözüm değil.**

---

## Regülasyon Notu (YÜZEYSEL — Hukuki Tavsiye Değildir)

Bu bölüm sadece genel farkındalık amaçlıdır, hukuki tavsiye teşkil etmez; kesin uyumluluk değerlendirmesi için yetkin bir hukuk danışmanına başvurulmalıdır. Bu araştırma derinlemesine hukuki analiz içermez.

Genel gözlem: Kripto sinyal/analiz ürünleri hangi ülkede kime hitap ettiğine, "yatırım tavsiyesi" ile "eğitim/bilgilendirme içeriği" arasındaki çizgiyi nasıl çizdiğine ve execution yapıp yapmadığına bağlı olarak farklı rejimlere tabi olabilir:

- **AB (MiCA — Markets in Crypto-Assets Regulation):** Kripto varlık hizmet sağlayıcıları (CASP) için lisanslama rejimi getiriyor; saf "sinyal/analiz" hizmetinin bu kapsama girip girmediği hizmetin tam niteliğine (tavsiye mi, sadece veri mi, execution var mı) bağlı — genel bilgi, bu oturumda AB hukuku derinlemesine araştırılmadı.
- **ABD:** "Yatırım tavsiyesi" niteliği taşıyan hizmetler SEC/CFTC ve eyalet düzeyinde farklı rejimlere (örn. Investment Advisers Act) tabi olabilir; kripto varlıkların menkul kıymet sayılıp sayılmadığı tartışması hâlâ devam ediyor. DFPI (Kaliforniya) gibi eyalet kurumlarının aktif "scam tracker" kayıtları var (yukarıda §5'te referans verildi) — bu, düzenleyicilerin bu alanı izlediğinin bir göstergesi.
- **Türkiye:** SPK (Sermaye Piyasası Kurulu) kripto varlık hizmet sağlayıcıları için düzenlemeler geliştiriyor; "yatırım tavsiyesi" niteliğindeki içerik lisanssız verilemez kuralı genel olarak biliniyor — bu oturumda güncel SPK mevzuatı derinlemesine araştırılmadı, **kaynak taraması yapılmadı**.
- **Genel prensip (çoğu yargı alanında ortak):** "Bu yatırım tavsiyesi değildir" uyarısı tek başına yasal koruma sağlamaz — hizmetin fiili niteliği (ne kadar spesifik, ne kadar kişiselleştirilmiş, execution'a ne kadar yakın) belirleyici oluyor genel olarak.

**Bu bölüm kapsam dışına çıkmadan kısa tutulmuştur — QUANTIX OS için özel bir uyumluluk/lisans değerlendirmesi bu raporun kapsamında değildir ve ayrı, hukuk uzmanı destekli bir çalışma gerektirir.**

---

## Araştırılamayan / Bulunamayan Veri Noktaları (Açık Liste)

Aşağıdaki veri noktaları için bu araştırmada güvenilir/doğrulanmış bir kaynak **bulunamadı** — tahmin edilmemiştir:
- 3Commas, Cryptohopper, CryptoQuant, Glassnode, Coinigy, Bitsgap için kesin/güncel (2026) bağımsız doğrulanmış kullanıcı sayıları
- Resmi 3commas.io/pricing, cryptohopper.com/pricing, cryptoquant.dev/resource/pricing sayfalarının doğrudan içeriği (403 engeliyle erişilemedi, ikincil kaynaklar kullanıldı)
- Wolfx, Learn2Trade ve diğer Telegram sinyal gruplarının bağımsız doğrulanmış (kendi iddiaları dışında) doğruluk/başarı oranı
- CryptoQuant ve Glassnode için kullanıcı şikayeti taraması (kapsam dışı bırakıldı — düşük öncelik, farklı segment)
- Türkiye SPK ve AB MiCA'nın bu spesifik hizmet türüne (execution'sız sinyal/analiz) uygulanabilirliğine dair derinlemesine hukuki analiz (kapsam dışı — kullanıcı talebiyle yüzeysel tutuldu)

---

**Not:** Bu rapor saf rekabet/pazar analizi amaçlıdır, yatırım tavsiyesi içermez.
