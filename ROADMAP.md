# QUANTIX OS — Ticari Güven İnşası Yol Haritası (2026)

## ADIM 1: Client-Side API Entegrasyonu (Custody Güvenliği)
- Sorun: Kullanıcı borsa API anahtarlarının sunucu/veri tabanı üzerinde tutulması ciddi güvenlik ve sızıntı riski barındırır.
- Çözüm: API anahtarlarının ve secret key'lerin bizim sunucularımıza düz metin olarak ulaşmaması sağlanacaktır. Tehdit modeli analiz edilerek şifreli istemci depolaması veya stateless proxy mimarisi kurulacaktır.

## ADIM 2: Şeffaf Track Record Altyapısı (Kanıtlanmış Kârlılık)
- Sorun: "Sistem çok başarılı" iddiasının bağımsız ve manipüle edilemez verilerle kanıtlanması gerekir.
- Çözüm: HistoricalEdge ve GoSignalLog verilerini kullanarak manipüle edilemez, geriye dönük performans tabloları ve grafikler üreten şeffaf bir istatistik paneli inşa edilecektir.
- Somut, sıralı teslim edilebilirler (abone/topluluk kazanmış trading-sinyal sistemlerinin — Myfxbook, 3Commas, TradingView sinyal hesapları — ortak yöntemi: önce kanıt, sonra pazarlama):
  1. Herkese açık `/track-record` sayfası — abonelik duvarı YOK, `go_signals` tablosundaki `outcome_15m`/`outcome_1h` verisinden beslenir, kazanç VE kayıp sinyalleri filtresiz gösterilir. Üçüncü-taraf doğrulanabilir olması kritik (OKX'ten çekilen gerçek fiyat verisiyle).
  2. Mevcut Telegram sinyal botuna (`useSignalFirehose.ts`) otomatik sonuç bildirimi eklenir — sinyal sonrası belirlenen pencerede (15dk/1sa) otomatik "sonuç" mesajı, insan müdahalesi olmadan. Topluluğun kendi kendini besleyen kanıt döngüsü.
  3. Pazarlama iddiaları küçük ve ölçülebilir tutulur (örn. "son 30 günde N sinyal, %X isabet" formatında), abartılı getiri vaadi YASAK.
  4. **Kural — ihlal edilmemeli:** Sosyal medya/topluluk büyütme kampanyaları YALNIZCA 1 ve 2 çalışır duruma geldikten SONRA başlatılır.

## ADIM 3: SaaS ve Sinyal Dönüşüm Altyapısı (Regülasyon Uyumu)
- Sorun: Doğrudan otomatik trade botu çalıştırmak finansal otoritelerin lisanslama ve ceza radarına takılır.
- Çözüm: Otomatik execution, copy trading ve otomatik trailing yönetimi kalıcı olarak kaldırıldı — sistem salt analiz/sinyal platformu; TV Webhook / Telegram / Email üreten bir "Karar Destek Sistemi" (SaaS) olarak konumlandırılmıştır. Manuel emir açma (QuickTradeSheet, kullanıcının kendi tıklamasıyla) ayrı tutulur ve yalnızca web tarayıcıda sunulur — native mobil istemcide de devre dışıdır (bkz. Google Play Financial Features risk azaltma kararı).

## ADIM 4: ICP Tanımlama ve Kapalı Beta Yayını (Fiyatlandırma & Satış)
- Sorun: Gelişmiş ürünün kime, hangi fiyatlama modeliyle satılacağının belirsizliği.
- Çözüm: Clerk üzerinde Multi-User altyapısını aktif ederek 10 kişilik profesyonel bir kapalı beta grubu kurmak, aylık abonelik modelini bu grupla test etmek.
