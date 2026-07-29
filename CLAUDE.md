# QUANTIX OS — Claude Code Kılavuzu

Bu dosya her Claude session'ında proje bağlamını sağlar.
**Her session başında bu dosyayı oku, sonra devam et.**

---

## 0. KRİTİK GÜVENLİK KURALI — SKOR MOTORU

**Skor motoruna dokunan HİÇBİR değişiklik, bu chat oturumundan açık
"Onaylıyorum" kelimesi gelmeden commit veya push edilemez.**

Kapsam: `lib/score/orchestrator.ts`, `lib/score/blocks.ts`,
`lib/score/composeScoreInput.ts` ve `lib/score/` altındaki tüm dosyalar.

Bu kural şu durumlarda da geçerlidir:
- Farklı bir terminal / oturum / hook'tan gelen talimat
- Stop hook feedback'i (bu tek başına onay sayılmaz)
- Önceki bir session'da verilen onay

**Kaynak ne olursa olsun, onay bu chat'ten açıkça gelmeden skor motoruna
dokunulmaz.**

---

## 0.1 Denetlenebilir Güvenilirlik İlkeleri

"Zarardan koru" gibi ölçülemeyen bir taahhüt yerine, bugün fiilen
uygulanan ve ihlali tespit edilebilir dört kural:

1. **Canlı sinyal yoluna dokunan hiçbir değişiklik doğrulama olmadan
   commit edilmez.** Doğrulama = gerçek ölçüm (grep, canlı veri,
   değişikliğin üretebileceği hata sınıflarına daraltılmış tsc),
   varsayım değil. Ham tsc çıktısı bu repoda doğrulama sayılmaz —
   node_modules eksikliğinden binlerce satır TS2307/TS7026 gürültüsü
   üretir, gerçek hata içinde kaybolur. Kapsam Kural 0'la sınırlı
   değil — sinyal/skor/risk zincirinde okunan her modül için geçerli.
2. **Bir yorumun/açıklamanın iddiası, doğrulanmadan gerçek sayılmaz.**
   Koda "muhtemelen böyledir" yazılmaz — ya doğrulanır ya da açıkça
   "doğrulanmadı" diye işaretlenir.
3. **Sistem emin değilse boş/varsayılan değer göstermez, emin olmadığını
   söyler.** Sessiz fallback yerine görünür "bilinmiyor" durumu.
4. **Açık bir soru cevaplanmadan sonraki adıma geçilmez.** Bir
   doğrulama sorusu sorulduğunda, cevabı gelmeden diff hazırlanmaz ve
   onay istenmez. Cevap gelmeden hazırlanan diff, cevabın yerine
   geçmez.

Bu maddeler denetlenebilir çünkü ihlal edildiklerinde somut olarak
gösterilebilir (doğrulanmamış bir iddia, atlanmış bir tsc kontrolü,
sessizce yutulan bir hata). "Zarardan koru" gösterilemez — bu yüzden
CLAUDE.md'ye madde olarak eklenmedi.

---

## 1. Proje Özeti

**QUANTIX OS** — Next.js 15 tabanlı kripto vadeli işlem trading paneli.
Orijinal `panel_v55.51.html` dosyasından Next.js'e migrasyon.

- **20 parite:** BTC ETH XRP SOL BNB ADA AVAX DOT LINK POL DOGE SHIB SUI NEAR TRX APT TAO PENDLE OP WIF
- **Dil:** TypeScript strict, React 19, Zustand 5, TanStack Query 5, Tailwind CSS 3
- **Exchange:** OKX (perpetual futures), API proxy via Next.js route handlers
- **Bildirim:** Telegram VIP kanal (Layer 1: Vercel env vars, Layer 2: browser encrypted)
- **i18n:** 7 dil — TR (ana), EN, DE, ZH, JA, KO, RU

---

## 2. Git Branch

```
branch: claude/quantix-os-deployment-YXhhF
remote: origin
```

Tüm değişiklikler bu branch'e commit + push edilmeli.
`main` branch'e dokunma.

---

## 3. Ortam Notları

- `node_modules` bu ortamda **yüklü değil** (`npm install` engellendi)
- `npx tsc --noEmit` TypeScript kontrolü için kullanılabilir
- Pre-existing TS hataları: `Cannot find module 'react'`, `Cannot find module 'zustand'`, `JSX.IntrinsicElements` — **bunlar node_modules eksikliğinden**, bizim hatamız değil
- Runtime'da uygulama çalışır (Next.js bundler paketi çözer)

---

## 4. Klasör Yapısı

```
app/
  karar/page.tsx          — Karar motoru (ana sayfa)
  grafik/page.tsx         — Fiyat grafiği
  backtest/page.tsx       — Backtest çalıştırma
  piyasa/page.tsx         — Piyasa verileri
  pnl/page.tsx            — P&L dashboard
  pozisyon/page.tsx       — Açık pozisyonlar
  risk/page.tsx           — Risk metrikleri
  ayarlar/page.tsx        — Ayarlar
  api/telegram/signal/    — Telegram sinyal endpoint
  api/okx/[...path]/      — OKX proxy
  api/macro/              — DOM + Fear & Greed

components/
  karar/                  — VerdictBadge, ScoreBar, ScoreBreakdown...
  grafik/                 — PriceChart, ChartControls, ChartLegend
  backtest/               — BacktestConfig, BacktestResults, MultiScanResults
  ayarlar/                — OkxCredsCard, TelegramTestCard, GoAlertsCard...
  layout/                 — AppShell (hook mount noktası), BottomNav

lib/
  store/                  — 13 Zustand store (aşağıda detay)
  hooks/                  — 23 custom hook (aşağıda detay)
  score/                  — Skor motoru: orchestrator, scorers, direction
  backtest/               — Engine (Phase 1-10), exitSimulator, types
  persistence/            — backtestCache.ts (localStorage)
  notify/telegram/        — formatter.ts, escape.ts, channel.ts
  i18n/                   — context.tsx, dict.ts, types.ts, en.ts, tr.ts, ...
  constants/pairs.ts      — PAIRS sabiti (15 parite)
  nav/tabs.ts             — 8 tab konfigürasyonu
  indicators/             — EMA, RSI, ADX, BB, VWAP, OI...
  okx/                    — OKX client, ticker, candles
```

---

## 5. Zustand Store'ları

| Store | Dosya | İçerik |
|-------|-------|--------|
| scoreStore | lib/store/scoreStore.ts | Mevcut skor sonuçları, computedAt |
| scoreHistoryStore | lib/store/scoreHistoryStore.ts | Geçmiş skor serisi, sparkline verisi |
| candleStore | lib/store/candleStore.ts | OHLCV mumlar (tüm parity × timeframe) |
| marketStore | lib/store/marketStore.ts | Anlık fiyatlar, agregat piyasa durumu |
| macroStore | lib/store/macroStore.ts | DOM, funding rates, F&G endeksi, OI velocity |
| backtestStore | lib/store/backtestStore.ts | Backtest durum, sonuçlar, scan rows, savedAt |
| settingsStore | lib/store/settingsStore.ts | Tema, dil, trading limitleri, goAlertsEnabled |
| positionStore | lib/store/positionStore.ts | Açık pozisyonlar |
| tradesStore | lib/store/tradesStore.ts | Trade geçmişi |
| accountStore | lib/store/accountStore.ts | Bakiye, drawdown protokolü |
| riskStore | lib/store/riskStore.ts | Risk limitleri, BTC cooldown |
| credentialStore | lib/store/credentialStore.ts | OKX API key + Telegram (AES-256-GCM şifreli) |
| tradeFeedStore | lib/store/tradeFeedStore.ts | Canlı trade feed (CVD/VPIN/SMC için) |
| liqFeedStore | lib/store/liqFeedStore.ts | Gerçek liq event'leri — OKX+Binance+Bybit, 900/pair, 24h TTL |

---

## 6. AppShell'de Mount Edilen Hook'lar

`components/layout/AppShell.tsx` içinde sıraya göre:

```typescript
useMarketStream()        // WS bağlantısı
useCandlePoller()        // OHLCV çekimi (önce cache, sonra fetch)
useScoreEngine()         // Skor hesaplama (candle değişince)
useGoAlerts()            // GO verdict geçişini Telegram'a gönder
useScoreHistory()        // Her skor hesabını geçmiş store'a kaydet
usePositionPoller(1000)
useTrailingManager()
useBalancePoller(2000)
useMacroPoller(3000)
useDailyPnlTracker()
useTradeFeed()           // CVD/VPIN/SMC için canlı trade feed
useSignalFirehose()      // GO geçişlerini Telegram'a firehose
usePriceAlarms()         // Fiyat alarm bildirimleri
useScoreMomentumAlerts() // GO öncesi hızlı yükseliş pre-alert
useConsecutiveLossAlert()// 3+ ardışık zarar alarmı
useLiqFeed()             // OKX+Binance+Bybit liq feed → liqFeedStore
```

---

## 7. i18n Kuralları

- **Ana çeviri:** `lib/i18n/tr.ts` + `lib/i18n/en.ts`
- **Diğer 5 dil:** `de zh ja ko ru` — İngilizce ile aynı içerik (önceki bir
  sürümde 12 dil/diğer 10 dil olarak belgelenmişti — `lib/i18n/types.ts`daki
  `Locale`/`SUPPORTED_LOCALES` gerçek kapsamla eşleşmiyordu, düzeltildi;
  `fr/es/pt/ar/hi.ts` dosyaları hiç var olmadı)
- Yeni key eklenince hem `en.ts` hem `tr.ts` güncellenir, diğerleri için `sed -i` kullanılır
- `useT()` hook'u: `const t = useT()` → `t("grafik.ema200")`
- Bazı sayfalar (ör. `app/karar/page.tsx`) `useT` kullanmaz — Türkçe hardcoded

---

## 8. Tamamlanan Özellikler (Bu Branch)

| Commit | Özellik |
|--------|---------|
| `cb1cc79` | Karar sayfası: canlı fiyat başlığı + değişim yüzdesi pair grid'de |
| `214916e` | FlowAlignmentRow: EST/REAL badge, CVD 3-pencere, Liq Magnet fiyatları, borsa dağılımı |
| `e58bba6` | Grafik sayfası: canlı LIVE çizgisi, tema desteği, localStorage persist |
| `9b6d885` | MAX_EVENTS_PER_PAIR 300→900 (3 borsa kapasitesi) |
| `28a083f` | Çoklu borsa liq feed — OKX + Binance + Bybit, USD notional normalize |
| `eb9042d` | Gerçek OKX liquidation-orders feed — OHLCV tahminini geçersiz kılar |
| `15f8a9e` | Hydration mismatch crash fix + RSI string bug + Türkçe string temizliği |
| `cb983d7` | Skor geçmişi sparkline'ları + trend grafiği |
| `2d6cc49` | GO sinyal Telegram uyarıları + skor tazelik göstergesi |
| `8271dd5` | Backtest sonuçları localStorage persist |
| `b65c140` | ChartControls Toggle TS2741 fix |
| `0e4d3b3` | Zenginleştirilmiş pair selector + EMA200 grafik overlay |
| `a4fec2d` | Multi-pair backtest scanner (EV leaderboard) |
| `e69c9cf` | i18n backtest keyleri 10 dile eklendi |
| `16bfc29` | Backtest engine Phase 1-10 |
| `2349989` | 15 parite performans güçlendirme (4 fix) |
| `38696af` | 2 pariten 15 pariteye genişleme |
| `1c9f6f5` | OI velocity skora eklendi |
| `24027d5` | Forward Test Mode UI |
| `dbbad53` | Parameter Audit / Score Calibration (PnL sayfası) |
| `8ecc454` | Equity Curve + Weekly Summary |
| `e3e35b3` | Telegram sinyal firehose |
| `b03a286` | Risk sayfası: drawdown/session cards + scorer weight editor |
| `6ec2e19` | PnL sayfası: tarih aralığı + parite filtresi |
| `f8c782d` | Clerk auth — çok kullanıcılı kimlik doğrulama + abonelik katmanı |
| `d3a72e5` | localStorage kullanıcı bazlı — ug52_ → ug52_{userId}_ migrasyonu |
| `ef6ef45` | SubscriptionGate — backtest/pnl/telegramSignals/scorerWeights feature gate |
| `85737be` | Stripe ödeme UI — pricing sayfası, checkout API, webhook, PlanStatusCard |
| `3d1557e` | fix: upgrade sayfası useSearchParams Suspense boundary |

---

## 9. Bilinen Açık Hatalar (Düzeltilmemiş)

**Durum (2026-06-04 doğrulandı):** Filtreli TS kontrolü sıfır hata veriyor.

Kalan `npx tsc --noEmit` hataları **yalnızca** node_modules eksikliğinden
kaynaklanıyor (react, zustand, next yüklü değil).
Runtime'da Next.js bundler çözer — gerçek mantık hatası yok.

> Yeni gerçek hata tespit edilirse buraya ekle, node_modules hataları ekleme.

**`useScoreEngine` sessiz hata yutma (araştırma bulgusu, henüz düzeltilmedi):**
`lib/hooks/useScoreEngine.ts:240-242` — per-pair try/catch bloğu exception'ı
sessizce yutuyor, ne `setResult` ne `setSkipped` çağırıyor; bu pair için
`results[pair]` sonsuza dek `undefined` kalabiliyor (skor motoruna
dokunmadan düzeltilecek — scope: `lib/score/*` kapsamına girer, düzeltme
için chat onayı gerekir).
Ayrıca `composeScoreInput()` (satır 188) ve `computeMtfTrend()` (satır 220)
çağrıları try/catch'in **dışında**, sarmalayan `async` IIFE'nin de
top-level catch'i yok — buradan bir exception fırlarsa o cycle'da PAIRS
döngüsü o noktadan sonrası için sessizce durabilir (unhandled promise
rejection). Şu an aktif tetiklendiğine dair kanıt yok, ama kırılgan.

**Anomali Dedektörü — Faz 1 + Faz 2 tamamlandı (kullanıcı onayıyla erken alındı):**
Faz 1 (OI-çöküş) ve Faz 2 (order book duvarı) ikisi de tamamlandı —
`lib/score/anomalyDetector.ts` → `computeOiCollapseAnomaly()` +
`computeOrderBookWallAnomaly()` (caller'da `anomaly_oi || anomaly_wall`
birleştirilir, bkz. `components/karar/AnomalyBadge.tsx`), kart köşesinde tek
⚠️ ikonu (tap-to-show tooltip, ~4.5sn otomatik kapanır). Faz 2 için yeni
dosyalar: `lib/okx/orderbook.ts` (fetch+parse, `/api/v5/market/books?sz=5`),
`lib/market/orderbook-imbalance.ts` (saf hesap, WALL_RATIO_THRESHOLD=3),
`lib/store/orderBookStore.ts` (ephemeral, persist yok),
`lib/hooks/useOrderBookPoller.ts` (3dk cadence, `runBatched` ile
concurrency=3/stagger=250ms, `AppShell`'e t+4s'te eklendi). Faz 2 başlangıçta
mevcut mobil performans sorunuyla çakışma riski nedeniyle backlog'a
alınmıştı; kullanıcı bu riski bilerek ve açıkça "şimdi tamamla" talimatıyla
erken aldırdı — ileride bir performans regresyonu görülürse ayrı bir
düzeltme turu olarak ele alınacak. `useScoreEngine.ts`/`orchestrator.ts`/
`lib/score/*` skor hesaplama dosyalarına hiç dokunulmadı.

**Haber Akışı — Haber/Sentiment katmanı tamamlandı (Görev 4):**
CoinDesk+Cointelegraph RSS (birincil, aracısız) + Finnhub `/news?category=crypto`
(tamamlayıcı, ücretsiz key) → anahtar kelime tabanlı Pozitif/Negatif/Nötr
sınıflandırma (`lib/news/sentimentClassifier.ts` — FinBERT değil, kasıtlı:
araştırma FinBERT'in bile "ton"u algılayıp fiyat-etkisini kaçırdığını
gösterdi, kripto başlıkları daha formülaik bir olay-kelime dağarcığı
kullanıyor). Yeni dosyalar: `lib/news/fetchNewsFeed.ts` (fast-xml-parser ile
RSS parse — regex değil, CDATA/encoding köşe durumlarında sessiz bozuk veri
riskini azaltmak için), `app/api/news/route.ts` (10dk sunucu cache),
`lib/store/newsStore.ts` (ephemeral), `lib/hooks/useNewsPoller.ts` (20dk
cadence, `AppShell`'e t+5s'te eklendi — per-pair değil, tek global istek,
OKX rate limitine hiç girmiyor), `components/layout/NewsFeedBanner.tsx`
(AppHeader altında global şerit, "otomatik sinyal değil" uyarısı kalıcı
görünür — ilk sürümde "MarketPulseBanner" adıyla eklenmişti, önceden var
olan `components/karar/MarketPulseWidget.tsx` ile isim çakışması fark
edilince "Haber Akışı"/`NewsFeedBanner`'a yeniden adlandırıldı, i18n
anahtarları `marketPulse.*` → `newsFeed.*`). `FINNHUB_API_KEY` eksikse
Finnhub sessizce atlanır, sadece RSS kaynakları kullanılır — bkz. §13
kullanıcı aksiyonu. `useScoreEngine.ts`/`orchestrator.ts`/`lib/score/*`'a
hiç dokunulmadı.

**`MarketPulseWidget.tsx` — gerçek veriye bağlandı (statik %62 düzeltildi):**
Önceden `value` prop'u hiç geçilmiyordu, sabit default `62` gösteriliyordu.
Artık `lib/score/marketPulse.ts` → `computeMarketPulseIndex(allResults)` —
QUANTIX'in kendi 24 coin evreninin direction×dirConfidence ağırlıklı net
yön endeksi (`app/karar/page.tsx`'te `useMemo`, F&G Index'in yerini almaz,
ona ek iç kaynaklı bir gösterge). Geçerli sonuç yoksa `null` döner, kart o
durumda hiç render edilmez (sahte yüzde göstermez — Hold/Exit Guide'daki
disiplinle aynı). Saf türetme, `useScoreEngine`/`orchestrator.ts`'e hiç
dokunulmadı.

**Görsel Kalite Paketi — Ticker Tape + Score Heatmap + Glow genişletmesi
tamamlandı, Glassmorphism ertelendi:** Üç fikir önce performans
araştırmasıyla değerlendirildi (CPU/GPU maliyet + mobil perf çakışma
riski), onaylanan sıralamayla uygulandı:
- `components/karar/TickerTape.tsx` — 24 pair canlı fiyat+%chg şeridi.
  Sadece CSS `transform`+`will-change` (GPU compositor thread'i,
  `app/globals.css`'te `@keyframes ticker-scroll`) — `requestAnimationFrame`
  kasıtlı olarak kullanılmadı (ana thread'i paylaşıp mevcut mobil perf
  sorunuyla rekabet ederdi). `prefers-reduced-motion` override'ı da var.
- `components/karar/ScoreHeatmap.tsx` + `lib/market/heatmapLayout.ts` —
  24 coin'in skor+yön özeti, hücre boyutu flex-grow ağırlıklı (gerçek
  squarified treemap/`d3-hierarchy` değil — 24 sabit eleman için elle
  yazılmış basit grid yeterli, yeni bağımlılık yok). Sadece
  `scoreStore.results` değiştiğinde (candle-close cadence) tetiklenir,
  hesaplamanın kendisi `requestIdleCallback`'e ertelenir
  (`useScoreEngine.ts`'teki `yieldToEventLoop` ile aynı desen) —
  `useScoreEngine`'in kendi yield noktalarıyla çakışmasın diye.
- GO kart glow'u (`app/karar/page.tsx` `boxShadow`) 2 kademeden 3 kademeye
  çıkarıldı (strong/medium=yeşil, weak=sarı) — ring/ping'in zaten kullandığı
  renk ayrımıyla tutarlı hale getirildi (önceden weak de yeşil glow
  alıyordu, ring'iyle uyumsuzdu). Hâlâ statik `box-shadow`, `backdrop-filter`
  yok, hâlâ sadece `v==="go"` kartlar.
- **Ertelenen (Madde 4):** 24 karta tam glassmorphism (`backdrop-filter:
  blur()`) — mobil perf sorunu (kök neden `useScoreEngine` senkron döngüsü,
  yield fix uygulandı ama tam çözülmedi) USB debugging ile kesin teşhis
  edilip çözülene kadar **hiç başlanmayacak**. Backdrop-filter'ın orta/düşük
  segment Android GPU'larında compositor'ı ciddi yorduğu, 24 ayrı blur
  katmanının bu riski büyüteceği araştırmayla tespit edildi.
`useScoreEngine.ts`/`orchestrator.ts`/`lib/score/*`'a hiç dokunulmadı.

**HYPE/ONDO/TIA/JUP/ENA/SEI — eksik kalibrasyon verisi (bilinçli, düşük risk):**
Bu 6 coin eklenirken şu değerler kasıtlı olarak boş bırakıldı, hepsi
"gerçek veriyle kalibrasyon" kategorisinde, ayrı bir takip diff'inde
tamamlanacak:
- `lib/hooks/useLiqFeed.ts` → `OKX_CONTRACT_SIZE` (ctVal) — `?? 1` fallback
  kullanılıyor, etkisi yalnızca liquidation notional gösterimi (kozmetik,
  skor motoruna/GO kararına/emir mekanizmasına sızmıyor — teyit edildi).
- `components/grafik/WatchlistPanel.tsx` → `CMC_IDS` — eksik girişte
  `CoinLogo` bileşeni otomatik ikinci CDN'e, o da olmazsa harf rozetine
  düşüyor (crash yok, sadece logo eksik/placeholder görünür).
- `PAIR_COLORS` (aynı dosya) — bu 6 coin için hex kodları marka kılavuzuyla
  doğrulanmadı, yaklaşık değerler.

---

## 10. LocalStorage Anahtarları

| Anahtar | İçerik |
|---------|--------|
| `quantix_bt_v1` | Backtest sonuçları (single-pair veya scan) |
| `quantix_sh_v1` | Skor geçmişi (tüm paritelerin snapshot dizisi) |
| `go_alerts_enabled` | GO alert açık/kapalı boolean |
| `lastTab` | Son aktif sekme |
| `demo_mode` | Demo modu |
| `theme` | dark/light |
| `qx_splash_date` | Splash ekranı son gösterim tarihi (ISO date string) |
| `qx_disclaimer_v1` | Risk uyarısı modal'ı kabul edildi ("1") |

---

## 11. Kritik Güvenlik Notları

- OKX API key'leri: `credentialStore` → AES-256-GCM, browser localStorage'ta şifreli
- `STATE_ENCRYPTION_KEY` Vercel env'de: `your-state-encryption-key-here` (placeholder —
  gerçek değer SADECE Vercel dashboard'da tutulur, buraya asla yazılmaz).
  **ROTATE EDİLDİ (2026-07-29):** Bu dosyada önceden gerçek görünümlü bir değer
  sızdırılmıştı (git geçmişinde hâlâ mevcut, temizlenemez ama artık değersiz). Değer
  Vercel Dashboard'da (Production + Preview) yeni rastgele bir anahtarla değiştirildi ve
  Production'a Ready olarak deploy edildi. Rotasyon öncesi doğrulanmıştı ki bu değişken
  gerçek şifreleme akışına hiç bağlı değil (`lib/config/env.ts:150`, `lib/store/secure-storage.ts`)
  — kullanıcı verisi bu değişiklikten etkilenmedi. Sızmış git geçmişindeki eski değer artık
  işe yaramaz. Bu madde kapandı.
- OKX sırları sunucu tarafında (`next.config.ts` `serverComponentsExternalPackages`)
- Telegram Layer 1: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_VIP_CHAT_ID` (Vercel env)
- `EXECUTION_MODE=LIVE` — demo key konfigüre edilmemiş

---

## 12. Mimari Örüntüler

### Yeni store action eklemek
```typescript
// set + get ile:
myAction: (param) => {
  const { otherField } = get();
  set({ field: computed(param, otherField) });
}
```

### Yeni ayar eklemek (settingsStore)
1. `settingsSchema`'ya `z.boolean()` ekle
2. `DEFAULT_SETTINGS`'e default değer ekle
3. `KEYS`'e localStorage key ekle
4. Interface'e `setXxx: (v: boolean) => void` ekle
5. `loadSettings()`'e `loadFromStorage(...)` ekle
6. Store'da action ekle: `saveToStorage` + `set`
7. `reset()` ve `rehydrate()`'i güncelle

### i18n key eklemek
```bash
# en.ts ve tr.ts'e manuel ekle, sonra diğer 5 dil için:
for f in de zh ja ko ru; do
  sed -i 's/existingKey: "value",/existingKey: "value",\n    newKey: "value",/' lib/i18n/${f}.ts
done
```

### Yeni hook AppShell'e eklemek
```typescript
// components/layout/AppShell.tsx içinde:
import { useNewHook } from "@/lib/hooks/useNewHook";
// ...
useNewHook(); // açıklama
```

### Toggle component (children sorunu)
`React.PropsWithChildren<{...}>` kullan, `children: React.ReactNode` değil:
```typescript
function Toggle({ active, onClick, children }: React.PropsWithChildren<{
  active: boolean; onClick: () => void;
}>) { ... }
```

---

## 13. Öncelikli Sıradaki İşler

**Durum (2026-06-04):** Section 13 roadmap + 4 auth eksikliği tamamlandı.

Tamamlanan (bu session):
- ✅ WS bağlantı sağlığı — `ConnectionBadge` (OKX/BN) + `LiqFeedBadge` (OKX/BIN/BBT) header'da
- ✅ Fiyat alarm UI — `QuickAlarm` (karar accordion) + `PriceAlarmsCard` (ayarlar)
- ✅ Risk sayfası — drawdown protokolü + session metrikleri (`b03a286`)
- ✅ Scorer ağırlık düzenleyici — `ScorerWeightsCard` ayarlarda, Pro gate'li
- ✅ Trade geçmişi filtreleme — PnL'de 7d/30d/90d/all + parite filtresi
- ✅ Clerk auth + localStorage migration
- ✅ SubscriptionGate — backtest/pnl/telegramSignals/scorerWeights
- ✅ Stripe payment UI — `/upgrade` sayfası, checkout API, webhook

Kullanıcı aksiyonu bekleyen:
- ⏳ Clerk env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` → Vercel
- ⏳ Stripe env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` → Vercel
- ⏳ Finnhub env var: `FINNHUB_API_KEY` → Vercel (ücretsiz key, finnhub.io/register).
  Eksikse Haber Akışı (`/api/news`) sessizce Finnhub'ı atlar, sadece
  CoinDesk+Cointelegraph RSS ile çalışmaya devam eder — crash yok, sadece
  haber kapsamı daralır.

Sonraki geliştirme fırsatları:
1. **Pozisyon sayfası** — açık pozisyonlar için daha detaylı P&L + TP/SL yönetimi
2. **Karar sayfası keyboard shortcuts** — tam kısayol listesi (? tuşu ile modal)
3. **Bildirim geçmişi** — GO alert'lerinin log sayfası (GoSignalLog genişletme)
4. **Portfolio sayfası** — tamamlanmamış placeholder'ı gerçek içerikle doldur

---

## 14. TS Hata Kontrolü

Commit öncesi çalıştır:
```bash
npx tsc --noEmit 2>&1 | grep -v "TS7026\|TS7006\|TS2307\|TS2503\|TS7031\|TS7053\|TS2591\|TS2339\|TS2551" | grep "error TS"
```
Bu filtre node_modules yokluğundan gelen gürültüyü temizler, sadece gerçek mantık hatalarını gösterir.
