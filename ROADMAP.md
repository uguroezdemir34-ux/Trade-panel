# QUANTIX OS — Ticari Güven İnşası Yol Haritası (2026)

## ADIM 1: Client-Side API Entegrasyonu (Custody Güvenliği)
- Sorun: Kullanıcı borsa API anahtarlarının sunucu/veri tabanı üzerinde tutulması ciddi güvenlik ve sızıntı riski barındırır.
- Çözüm: API anahtarlarının ve secret key'lerin bizim sunucularımıza düz metin olarak ulaşmaması sağlanacaktır. Tehdit modeli analiz edilerek şifreli istemci depolaması veya stateless proxy mimarisi kurulacaktır.

## ADIM 2: Şeffaf Track Record Altyapısı (Kanıtlanmış Kârlılık)
- Sorun: "Sistem çok başarılı" iddiasının bağımsız ve manipüle edilemez verilerle kanıtlanması gerekir.
- Çözüm: HistoricalEdge ve GoSignalLog verilerini kullanarak manipüle edilemez, geriye dönük performans tabloları ve grafikler üreten şeffaf bir istatistik paneli inşa edilecektir.

## ADIM 3: SaaS ve Sinyal Dönüşüm Altyapısı (Regülasyon Uyumu)
- Sorun: Doğrudan otomatik trade botu çalıştırmak finansal otoritelerin lisanslama ve ceza radarına takılır.
- Çözüm: Otomatik execution, copy trading ve otomatik trailing yönetimi kalıcı olarak kaldırıldı — sistem salt analiz/sinyal platformu; TV Webhook / Telegram / Email üreten bir "Karar Destek Sistemi" (SaaS) olarak konumlandırılmıştır. Manuel emir açma (QuickTradeSheet, kullanıcının kendi tıklamasıyla) ayrı tutulur ve yalnızca web tarayıcıda sunulur — native mobil istemcide de devre dışıdır (bkz. Google Play Financial Features risk azaltma kararı).

## ADIM 4: ICP Tanımlama ve Kapalı Beta Yayını (Fiyatlandırma & Satış)
- Sorun: Gelişmiş ürünün kime, hangi fiyatlama modeliyle satılacağının belirsizliği.
- Çözüm: Clerk üzerinde Multi-User altyapısını aktif ederek 10 kişilik profesyonel bir kapalı beta grubu kurmak, aylık abonelik modelini bu grupla test etmek.
