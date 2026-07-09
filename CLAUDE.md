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

## 1. Proje Özeti

**QUANTIX OS** — Next.js 15 tabanlı kripto vadeli işlem trading paneli.
Orijinal `panel_v55.51.html` dosyasından Next.js'e migrasyon.

- **20 parite:** BTC ETH XRP SOL BNB ADA AVAX DOT LINK POL DOGE SHIB SUI NEAR TRX APT TAO PENDLE OP WIF
- **Dil:** TypeScript strict, React 19, Zustand 5, TanStack Query 5, Tailwind CSS 3
- **Exchange:** OKX (perpetual futures), API proxy via Next.js route handlers
- **Bildirim:** Telegram VIP kanal (Layer 1: Vercel env vars, Layer 2: browser encrypted)
- **i18n:** 12 dil — TR (ana), EN, DE, FR, ES, PT, ZH, JA, KO, RU, AR, HI

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
- **Diğer 10 dil:** `de fr es pt zh ja ko ru ar hi` — İngilizce ile aynı içerik
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
- `STATE_ENCRYPTION_KEY` Vercel env'de: `Vaakb/KgX9J/bIbPti/+Z9elm+ig5EZhohXKFDBep18=`
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
# en.ts ve tr.ts'e manuel ekle, sonra diğer 10 dil için:
for f in de fr es pt zh ja ko ru ar hi; do
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
