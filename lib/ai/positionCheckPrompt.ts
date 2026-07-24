/**
 * "AI'ya Sor" — pozisyon durum-kontrolü prompt üretimi + yanıt parse.
 *
 * Saf fonksiyonlar, hiçbir state/network'e bağlı değil. lib/score/*'a hiç
 * dokunmaz — YENİ bir skor hesaplamaz, sadece zaten hesaplanmış iki
 * snapshot'ı (giriş anı + şu an) Anthropic'e karşılaştırtır.
 *
 * Anthropic'e ASLA "al/sat/kapat/tut" tarzı bir emir ürettirmiyoruz — sadece
 * "gerekçe hâlâ geçerli mi" değerlendirmesi. Yanıt formatı serbest metin
 * değil, sabit "DURUM: <ETIKET>\n<açıklama>" şablonu — server tarafında
 * regex ile parse edilip UI'ın 🟢/🟡/🔴 rengine eşleniyor. Beklenmeyen
 * formatta gelirse parseAiCheckResponse() null döner — caller bunu hata
 * olarak ele almalı, ASLA uydurma bir sonuç göstermemeli.
 */

export interface ScoreSnapshotForPrompt {
  score: number;
  verdict: string;
  direction: string;
  /** score_history'de saklanmıyor — giriş anı snapshot'ında undefined. */
  dirConfidence: number | undefined;
  regime: string | null;
  blocks: string[];
  softBlocks: string[];
  sub: {
    trend: number;
    adx: number;
    rsi: number;
    vol: number;
    bb: number;
    vwap: number;
    funding: number;
    macro: number;
  };
}

export interface PositionCheckPromptParams {
  pair: string;
  direction: "LONG" | "SHORT";
  entrySnapshot: (ScoreSnapshotForPrompt & { price: number; signalTs: number }) | null;
  currentSnapshot: ScoreSnapshotForPrompt;
  currentPrice: number;
  currentPnlPct: number;
}

export type AiCheckStatus = "green" | "yellow" | "red";

// Karşılaştırma modu (giriş anı verisi VAR) — giriş gerekçesi vs. şu anki durum
const COMPARE_LABEL_MAP: Record<string, AiCheckStatus> = {
  GECERLI: "green",
  ZAYIFLIYOR: "yellow",
  GECERSIZ: "red",
};

// Sadece-güncel-durum modu (giriş anı verisi YOK) — karşılaştırma yapılamaz
const CURRENT_ONLY_LABEL_MAP: Record<string, AiCheckStatus> = {
  GUCLU: "green",
  NOTR: "yellow",
  ZAYIF: "red",
};

const BASE_RULES = `Sen QUANTIX OS trading panelinin bir parçasısın. Görevin, kullanıcının halihazırda AÇIK olan bir pozisyonu için teknik durumu değerlendirmek.

KESİN KURALLAR:
- ASLA "al", "sat", "pozisyonu kapat", "tut", "ekle" gibi bir emir veya tavsiye verme. Sen bir yatırım danışmanı değilsin, sadece teknik gerekçeyi özetleyen bir analiz aracısın.
- SADECE sana verilen skor/rejim/alt-skor verilerine dayan. Veri dışında hiçbir varsayım, tahmin veya uydurma yapma.
- Yanıtın TAM OLARAK aşağıdaki formatta olsun, başka hiçbir ek metin, selamlama veya açıklama ekleme.`;

export function buildSystemPrompt(hasEntryData: boolean): string {
  if (hasEntryData) {
    return `${BASE_RULES}

Görevin: pozisyonun GİRİŞ ANINDAKİ teknik gerekçesi (skor/yön/rejim) ile ŞU ANKİ teknik durumu karşılaştırmak.

Format:
DURUM: <GECERLI|ZAYIFLIYOR|GECERSIZ>
<Türkçe, 2-3 cümlelik, teknik gerekçeye odaklı açıklama>

Etiket anlamları:
- GECERLI: giriş anındaki yön/skor/rejim şu anki durumla büyük ölçüde tutarlı.
- ZAYIFLIYOR: skor belirgin düşmüş, rejim değişmiş veya karşıt sinyaller belirmiş ama henüz tam tersine dönmemiş.
- GECERSIZ: yön artık tam tersi, yeni bir hard block oluşmuş veya skor/rejim giriş gerekçesini büyük ölçüde geçersiz kılıyor.`;
  }

  return `${BASE_RULES}

Giriş anına ait skor verisi mevcut değil — bu yüzden bir KARŞILAŞTIRMA YAPAMAZSIN. Bunun yerine SADECE şu anki teknik duruma (skor/rejim/alt-skorlar) dayanarak genel bir değerlendirme ver.

Format:
DURUM: <GUCLU|NOTR|ZAYIF>
<Türkçe, 2-3 cümlelik, teknik gerekçeye odaklı açıklama>

Etiket anlamları:
- GUCLU: şu anki skor/rejim pozisyon yönünü güçlü destekliyor.
- NOTR: karışık sinyaller var, ne güçlü destek ne net zayıflık.
- ZAYIF: şu anki skor/rejim pozisyon yönünü zayıf destekliyor veya karşıt sinyaller baskın.`;
}

function fmtSnapshot(label: string, s: ScoreSnapshotForPrompt, price?: number): string {
  const dirLine = s.dirConfidence !== undefined
    ? `  Yön: ${s.direction} (güven: ${s.dirConfidence.toFixed(2)})`
    : `  Yön: ${s.direction}`;
  const lines = [
    `${label}:`,
    `  Skor: ${s.score.toFixed(1)} | Verdict: ${s.verdict}`,
    dirLine,
    `  Rejim: ${s.regime ?? "bilinmiyor"}`,
    `  Alt-skorlar: trend=${s.sub.trend.toFixed(1)} adx=${s.sub.adx.toFixed(1)} rsi=${s.sub.rsi.toFixed(1)} vol=${s.sub.vol.toFixed(1)} bb=${s.sub.bb.toFixed(1)} vwap=${s.sub.vwap.toFixed(1)} funding=${s.sub.funding.toFixed(1)} macro=${s.sub.macro.toFixed(1)}`,
    `  Bloklar: ${s.blocks.length > 0 ? s.blocks.join(", ") : "yok"}`,
    `  Yumuşak bloklar: ${s.softBlocks.length > 0 ? s.softBlocks.join(", ") : "yok"}`,
  ];
  if (price !== undefined) lines.push(`  Fiyat: ${price}`);
  return lines.join("\n");
}

export function buildUserMessage(params: PositionCheckPromptParams): string {
  const { pair, direction, entrySnapshot, currentSnapshot, currentPrice, currentPnlPct } = params;
  const parts = [
    `Pozisyon: ${pair} ${direction}`,
    `Şu anki fiyat: ${currentPrice} | Şu anki PnL: ${currentPnlPct >= 0 ? "+" : ""}${currentPnlPct.toFixed(2)}%`,
  ];
  if (entrySnapshot) {
    parts.push(fmtSnapshot("GİRİŞ ANI (yaklaşık, en yakın kayıtlı bar)", entrySnapshot, entrySnapshot.price));
  }
  parts.push(fmtSnapshot("ŞU AN", currentSnapshot, currentPrice));
  return parts.join("\n\n");
}

export interface ParsedAiCheckResult {
  status: AiCheckStatus;
  message: string;
}

/**
 * AI'nin metin yanıtını parse eder. Beklenen "DURUM: <ETIKET>\n<açıklama>"
 * formatında değilse veya etiket bilinen setin dışındaysa null döner —
 * caller bunu "analiz yapılamadı" hatası olarak ele almalı, uydurma bir
 * status/mesaj ÜRETMEMELİ.
 */
export function parseAiCheckResponse(text: string, hasEntryData: boolean): ParsedAiCheckResult | null {
  const match = /^DURUM:\s*(\S+)/m.exec(text.trim());
  if (!match) return null;

  const label = match[1].toUpperCase();
  const map = hasEntryData ? COMPARE_LABEL_MAP : CURRENT_ONLY_LABEL_MAP;
  const status = map[label];
  if (!status) return null;

  const message = text.slice(match.index + match[0].length).trim();
  if (!message) return null;

  return { status, message };
}
