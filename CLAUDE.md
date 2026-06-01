# QUANTIX OS — Claude Code Kılavuzu

Bu dosya her Claude session'ında proje bağlamını sağlar.
**Her session başında bu dosyayı oku, sonra devam et.**

---

## 1. Proje Özeti

**QUANTIX OS** — Next.js 15 tabanlı kripto vadeli işlem trading paneli.
Orijinal `panel_v55.51.html` dosyasından Next.js'e migrasyon.

- **15 parite:** BTC ETH XRP SOL BNB ADA AVAX DOT LINK POL DOGE SHIB SUI NEAR FET
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
  karar/                  — VerdictBadge, ScoreBar, ScoreSparkline, ScoreBreakdown...
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
| tradeFeedStore | lib/store/tradeFeedStore.ts | Canlı trade feed |

---

## 6. AppShell'de Mount Edilen Hook'lar

`components/layout/AppShell.tsx` içinde sıraya göre:

```typescript
useMarketStream()      // WS bağlantısı
useCandlePoller()      // OHLCV çekimi (önce cache, sonra fetch)
useScoreEngine()       // Skor hesaplama (candle değişince)
useGoAlerts()          // GO verdict geçişini Telegram'a gönder
useScoreHistory()      // Her skor hesabını geçmiş store'a kaydet
usePositionPoller(1000)
useTrailingManager()
useBalancePoller(2000)
useMacroPoller(3000)
useDailyPnlTracker()
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

---

## 9. Bilinen Açık Hatalar (Düzeltilmemiş)

Bunlar **pre-existing** gerçek TS hataları — uygulama çalışır ama derleme temiz değil:

| Dosya | Hata | Neden |
|-------|------|-------|
| `lib/okx/ticker.ts(13)` | TS2740: `Record<Pair, string>` 13 pair eksik | 15-pair genişlemesinde güncellenmedi |
| `components/pozisyon/PositionCard.tsx(329)` | `locale: "en" \| "tr"` → Locale 12 değer | i18n genişlemesinde daraltılmadı |
| `components/risk/DisciplineLogList.tsx(99)` | Aynı Locale daraltma sorunu | — |
| `app/pozisyon/page.tsx(55)` | Position prop type mismatch | — |
| `components/piyasa/FundingRateRow.tsx(50)` | `key` prop spread | — |
| `components/pnl/ParameterAudit.tsx(89,184,234,299)` | `children` missing (React.ReactNode) | @types/react yüklü değil |
| `lib/hooks/useTrailingManager.ts(46)` | TrailingDeps mismatch | — |
| `lib/exchange/idempotency.ts(46)` | Crypto type conversion | — |
| `lib/store/marketStore.ts(60)` | Unused `get` param | noUnusedParameters |

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

Aşağıdan seç veya "devam" de — en üstten başlanır:

1. **Açık TS hatalarını düzelt** — `ticker.ts` (13 pair), Locale daraltma, `FundingRateRow` key, `marketStore` unused param
2. **Grafik sayfası geliştirmeleri** — Hacim barları, RSI panel
3. **Backtest compare** — İki backtest sonucunu yan yana karşılaştır
4. **Fiyat alarm sistemi** — Belirli bir fiyat seviyesine ulaşınca Telegram bildirimi
5. **Karar sayfası yenilemesi** — Pair gruplama (majors / alts / meme), filtre
6. **PnL sayfası iyileştirme** — Aylık breakdown, R-multiple dağılım grafiği

---

## 14. TS Hata Kontrolü

Commit öncesi çalıştır:
```bash
npx tsc --noEmit 2>&1 | grep -v "TS7026\|TS7006\|TS2307\|TS2503\|TS7031\|TS7053\|TS2591\|TS2339\|TS2551" | grep "error TS"
```
Bu filtre node_modules yokluğundan gelen gürültüyü temizler, sadece gerçek mantık hatalarını gösterir.
