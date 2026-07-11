/**
 * MACRO SCORE (GENİŞLETİLMİŞ) — F&G + ABD borsaları (S&P500/NASDAQ proxy) + DXY.
 *
 * DURUM: Bu dosya HENÜZ orchestrator.ts/composeScoreInput.ts'e BAĞLANMADI.
 * scorers.ts → scoreMacro() (7 pts, sadece F&G) hâlâ tek aktif MACRO
 * kaynağı — orada HİÇBİR EŞİK DEĞİŞTİRİLMEDİ. Bu dosya sadece yeni
 * building block'ları sağlıyor, canlı skor hesabına henüz etkisi yok.
 *
 * fgScore burada scoreMacro()'nun AYNI bant mantığını (30-60 healthy,
 * <20/>80 extreme, yön-bağımlı contrarian ödül) kullanır — sadece FG_RESCALE
 * (4/7) ile orantılı olarak 7 puanlık ölçekten 4 puanlık ölçeğe indirilir.
 * Bu, "mevcut eğriyi 4 puana normalize et" isteğinin (fg/100*4 gibi naif
 * lineer bir formül DEĞİL) doğru okunuşu — eşikler scoreMacro ile birebir
 * aynı kalır, sadece çıktı ölçeği orantılı küçülür.
 *
 * equity/dxy legleri piyasa kapalıyken (hafta sonu/tatil/mesai dışı) veya
 * veri yoksa tam nötr (maxPts*0.5) döner — kapalı piyasa "kötü" sinyal
 * değildir. Yarım gün (13:00 ET kapanış) confidence damping ile (ham skor
 * + nötr ortalaması) daha az ağırlıklı sayılır.
 */

import type { Direction } from "./direction";
import { isUSMarketHoliday, isUSMarketHalfDay } from "./usMarketHolidays";

const ET_TIME_ZONE = "America/New_York";

interface ETParts {
  dateStr: string; // "YYYY-MM-DD"
  hour: number; // 0-23
  minute: number; // 0-59
  weekday: number; // 0=Sun .. 6=Sat
}

const ET_WEEKDAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function getETParts(date: Date): ETParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  // hour12:false bazı ortamlarda gece yarısı için "24" döndürebilir — %24 ile normalize.
  const hour = parseInt(get("hour"), 10) % 24;
  const minute = parseInt(get("minute"), 10);
  const weekday = ET_WEEKDAY_MAP[get("weekday")] ?? -1;

  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    minute,
    weekday,
  };
}

/** ET (America/New_York) tarihi, "YYYY-MM-DD" — usMarketHolidays.ts ile aynı format. */
export function getETDateString(date: Date): string {
  return getETParts(date).dateStr;
}

/** ET saati, 0-23. */
export function getETHour(date: Date): number {
  return getETParts(date).hour;
}

/** ET haftanın günü, 0=Pazar .. 6=Cumartesi. */
export function getETWeekday(date: Date): number {
  return getETParts(date).weekday;
}

export interface USMarketStatus {
  open: boolean;
  halfDay: boolean;
}

const MARKET_OPEN_MINUTES = 9 * 60 + 30; // 09:30 ET
const MARKET_CLOSE_MINUTES = 16 * 60; // 16:00 ET
const MARKET_HALF_DAY_CLOSE_MINUTES = 13 * 60; // 13:00 ET

/** NYSE açık mı — hafta sonu + tatil + mesai saati (yarım günse 13:00 ET kapanış) kontrolü. */
export function isUSMarketOpen(date: Date): USMarketStatus {
  const p = getETParts(date);

  if (p.weekday === 0 || p.weekday === 6) return { open: false, halfDay: false };
  if (isUSMarketHoliday(p.dateStr)) return { open: false, halfDay: false };

  const halfDay = isUSMarketHalfDay(p.dateStr);
  const minutesSinceMidnight = p.hour * 60 + p.minute;
  const closeMinutes = halfDay ? MARKET_HALF_DAY_CLOSE_MINUTES : MARKET_CLOSE_MINUTES;

  const open =
    minutesSinceMidnight >= MARKET_OPEN_MINUTES && minutesSinceMidnight < closeMinutes;
  return { open, halfDay };
}

// ───────── F&G LEG (4 pts — scoreMacro'nun 7 pts eğrisinin orantılı küçültülmüşü) ─────────

const FG_ORIGINAL_MAX = 7; // scorers.ts → scoreMacro() ile aynı ölçek
const FG_MAX = 4;
const FG_RESCALE = FG_MAX / FG_ORIGINAL_MAX;

function scoreFgLeg(fg: number | null, direction: Direction): number {
  if (fg === null) return FG_MAX * 0.5; // veri yoksa nötr — equity/dxy legleriyle tutarlı

  const isLong = direction === "LONG";
  const isShort = direction === "SHORT";

  // Bantlar scorers.ts → scoreMacro() (7 pts) ile BİREBİR AYNI — hiçbir eşik
  // değişmedi, sadece çıktı FG_RESCALE ile orantılı olarak küçültülüyor.
  let original: number;
  if (fg >= 30 && fg <= 60) original = 7;
  else if (fg < 20) original = isLong ? 5 : 2;
  else if (fg > 80) original = isShort ? 5 : 2;
  else if (fg >= 20 && fg < 30) original = 4;
  else if (fg > 60 && fg <= 80) original = 4;
  else original = 0; // fg === 20 edge case — scoreMacro ile aynı davranış

  return original * FG_RESCALE;
}

// ───────── EQUITY / DXY LEG (parametrik maxPts) ─────────

const EQUITY_LEG_RANGE_PCT = 1.5; // ±1.5% değişim → 0..maxPts lineer normalize

/**
 * Piyasa kapalıysa veya changePct yoksa tam nötr (maxPts*0.5) döner.
 * Açıksa changePct ±1.5% aralığında 0..1'e normalize edilip maxPts ile çarpılır.
 * Yarım günse (13:00 ET erken kapanış) ham skor ile nötrün ortalaması alınır
 * (confidence damping — kısaltılmış seansın sinyali tam ağırlıkta sayılmaz).
 */
export function scoreEquityLeg(
  changePct: number | null,
  marketOpen: boolean,
  maxPts: number,
  isHalfDay = false,
): number {
  const neutralScore = maxPts * 0.5;
  if (!marketOpen || changePct === null) return neutralScore;

  const clamped = Math.max(-EQUITY_LEG_RANGE_PCT, Math.min(EQUITY_LEG_RANGE_PCT, changePct));
  const normalized = (clamped + EQUITY_LEG_RANGE_PCT) / (2 * EQUITY_LEG_RANGE_PCT); // 0..1
  const rawScore = normalized * maxPts;

  return isHalfDay ? rawScore * 0.5 + neutralScore * 0.5 : rawScore;
}

/** İki değişimin ortalaması — biri null ise diğeri tek başına kullanılır, ikisi de null ise null. */
function avgChangePct(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return (a + b) / 2;
}

export interface MacroScoreInput {
  fearGreedIndex: number | null;
  sp500ChangePct: number | null;
  nasdaqChangePct: number | null;
  dxyChangePct: number | null;
  direction: Direction;
  /** Test edilebilirlik için — verilmezse new Date() kullanılır. */
  now?: Date;
}

export interface MacroScoreResult {
  score: number;
  breakdown: {
    fgScore: number;
    equityScore: number;
    dxyScore: number;
  };
  marketOpen: boolean;
  halfDay: boolean;
}

const EQUITY_MAX = 2.5;
const DXY_MAX = 1.5;

/**
 * Genişletilmiş MACRO skoru — F&G (4) + ABD borsaları proxy ortalaması (2.5)
 * + DXY (1.5, ters orantılı) = 8 pts toplam.
 *
 * NOT: orchestrator.ts'teki BASE_MAX.macro hâlâ 7 (sadece scoreMacro/F&G).
 * Bu fonksiyon oraya henüz bağlı değil — bağlanırsa BASE_MAX.macro'nun
 * 7'den 8'e çıkması ve buna bağlı toplam skor ölçeği (100→101) + goThreshold
 * (80/100) etkisinin ayrıca değerlendirilmesi gerekir.
 */
export function calculateMacroScore(input: MacroScoreInput): MacroScoreResult {
  const now = input.now ?? new Date();
  const { open: marketOpen, halfDay } = isUSMarketOpen(now);

  const fgScore = scoreFgLeg(input.fearGreedIndex, input.direction);

  const equityChangePct = avgChangePct(input.sp500ChangePct, input.nasdaqChangePct);
  const equityScore = scoreEquityLeg(equityChangePct, marketOpen, EQUITY_MAX, halfDay);

  // DXY ters orantılı: dolar güçlenmesi (DXY yukarı) risk-off eğilimi taşır.
  const dxyChangePct = input.dxyChangePct === null ? null : -input.dxyChangePct;
  const dxyScore = scoreEquityLeg(dxyChangePct, marketOpen, DXY_MAX, halfDay);

  return {
    score: fgScore + equityScore + dxyScore,
    breakdown: { fgScore, equityScore, dxyScore },
    marketOpen,
    halfDay,
  };
}
