/**
 * FLOW VERDICT — Order flow analizinin Score Engine'e nasıl yansıyacağı.
 *
 * Bu, "iki aşamalı süzgeç" mimarisinin ikinci aşaması (Uğur'un vizyon):
 *   1. Score Engine: indikatörler skoru üretir (mevcut sistem)
 *   2. Flow Filter: CVD + Divergence ile onay/red/skor ayarı
 *
 * Tasarım:
 *   - Adjustment: -10 ila +10 puan
 *   - VETO: extreme ters durumlarda sinyal iptal
 *   - Confidence multiplier: 0.5x-1.5x (güveni güçlendir/zayıflat)
 *
 * Önemli kural: Flow filter TEK BAŞINA sinyal üretmez, sadece mevcut
 * sinyali güçlendirir veya zayıflatır. Bu, "indicator overload" sorununu
 * çözer (kullanıcının yazdığı vizyon).
 */

import type { Pair } from "@/lib/constants/pairs";
import type { Trade } from "./types";
import {
  computeCvdMultiFrame,
  type CvdMultiFrame,
  type CvdDirection,
} from "./cvd";
import {
  detectMultiFrameDivergence,
  type MultiFrameDivergence,
} from "./divergence";
import {
  computeVpinResult,
  vpinScoreMultiplier,
  type VpinResult,
  type VpinState,
} from "./vpin";

/**
 * Sinyalin yönü — Score Engine'in karar yönü ile karşılaştırılır.
 */
export type SignalDirection = "LONG" | "SHORT";

/**
 * Flow filter çıktısı — Score Engine bunu okur ve uygular.
 */
export interface FlowVerdict {
  pair: Pair;
  /** Sinyal yönü (Score Engine kararı) */
  signalDirection: SignalDirection;

  /** CVD multi-frame raw veri (transparency için) */
  cvd: CvdMultiFrame;
  /** Divergence multi-frame raw veri */
  divergence: MultiFrameDivergence;
  /** VPIN sonucu (varsa) */
  vpin: VpinResult | null;

  /** Alignment kategorisi (UI için) */
  alignment:
    | "strong_align" // 3/3 onay, divergence yok
    | "weak_align" // 2/3 onay
    | "neutral" // belirsiz
    | "weak_oppose" // 1/3 onay veya zayıf divergence
    | "strong_oppose"; // 3/3 ters veya güçlü divergence

  /** Score Engine'e eklenecek puan (-10 ila +10) */
  scoreAdjustment: number;

  /** Confidence çarpanı (0.5-1.5) */
  confidenceMultiplier: number;

  /** VETO: sinyal iptal edilmeli mi? */
  vetoed: boolean;
  /** VETO sebebi (varsa) */
  vetoReason: string | null;

  /** İnsan-okunaklı özet */
  humanSummary: string;
}

/**
 * CVD direction sinyal yönüyle uyumlu mu?
 */
function isAligned(
  signalDir: SignalDirection,
  cvdDir: CvdDirection,
): boolean {
  if (cvdDir === "neutral") return false;
  return (
    (signalDir === "LONG" && cvdDir === "bullish") ||
    (signalDir === "SHORT" && cvdDir === "bearish")
  );
}

/**
 * CVD direction sinyal yönüyle ters mi?
 */
function isOpposed(
  signalDir: SignalDirection,
  cvdDir: CvdDirection,
): boolean {
  if (cvdDir === "neutral") return false;
  return (
    (signalDir === "LONG" && cvdDir === "bearish") ||
    (signalDir === "SHORT" && cvdDir === "bullish")
  );
}

/**
 * Divergence sinyal yönüyle ters mi?
 *   LONG sinyalinde bearish divergence VETO sebebi
 *   SHORT sinyalinde bullish divergence VETO sebebi
 */
function isDivergenceVeto(
  signalDir: SignalDirection,
  divergenceType: MultiFrameDivergence["confluenceType"],
): boolean {
  if (signalDir === "LONG" && divergenceType === "bearish_divergence") {
    return true;
  }
  if (signalDir === "SHORT" && divergenceType === "bullish_divergence") {
    return true;
  }
  return false;
}

/**
 * Ana fonksiyon: trade'ler + sinyal yönü → FlowVerdict.
 *
 * @param vpinState VPIN engine state'i (yoksa `undefined` — açıkça geçilmeli)
 * @param vpinConfigured Bucket boyutu vol24h'tan netleşti mi (bkz.
 *   PairFeedState.vpinConfigured). BİLEREK varsayılan değeri YOK (chat'te
 *   karar verildi, bkz. computeVpinResult()'taki aynı gerekçe) — `now` ve
 *   `vpinState` de bu yüzden zorunlu hale getirildi: TypeScript "opsiyonel
 *   parametreden sonra zorunlu parametre olamaz" kuralı gereği, vpinConfigured
 *   zorunlu olunca ondan ÖNCEKİ hiçbir parametre opsiyonel/varsayılanlı
 *   kalamıyordu — bu yan etki değil, dilin kendi kısıtı.
 */
export function computeFlowVerdict(
  pair: Pair,
  trades: readonly Trade[],
  signalDirection: SignalDirection,
  now: number,
  vpinState: VpinState | undefined,
  vpinConfigured: boolean,
): FlowVerdict {
  const cvd = computeCvdMultiFrame(pair, trades, now);
  const divergence = detectMultiFrameDivergence(pair, trades, now);
  const vpin = vpinState ? computeVpinResult(vpinState, vpinConfigured) : null;

  // VETO kontrolü ÖNCE — multi-frame divergence
  if (divergence.confluence && isDivergenceVeto(signalDirection, divergence.confluenceType)) {
    return {
      pair,
      signalDirection,
      cvd,
      divergence,
      vpin,
      alignment: "strong_oppose",
      scoreAdjustment: -10,
      confidenceMultiplier: 0.5,
      vetoed: true,
      vetoReason:
        divergence.confluenceType === "bearish_divergence"
          ? "Multi-window bearish divergence — smart money selling"
          : "Multi-window bullish divergence — smart money buying",
      humanSummary: "VETO — Smart money in opposite direction",
    };
  }

  // Confluence sayısı
  const totalFrames = 3; // 1m, 5m, 15m
  let alignCount = 0;
  let opposeCount = 0;

  for (const w of [cvd.w1m, cvd.w5m, cvd.w15m]) {
    if (isAligned(signalDirection, w.direction)) alignCount += 1;
    if (isOpposed(signalDirection, w.direction)) opposeCount += 1;
  }

  // Alignment kategorisi belirle
  let alignment: FlowVerdict["alignment"];
  let scoreAdjustment: number;
  let confidenceMultiplier: number;
  let humanSummary: string;

  if (alignCount === totalFrames) {
    alignment = "strong_align";
    scoreAdjustment = 10;
    confidenceMultiplier = 1.5;
    humanSummary = "STRONG CONFIRM — Flow aligned across all windows";
  } else if (alignCount >= 2) {
    alignment = "weak_align";
    scoreAdjustment = 5;
    confidenceMultiplier = 1.2;
    humanSummary = "MILD CONFIRM — Flow mostly aligned";
  } else if (opposeCount === totalFrames) {
    alignment = "strong_oppose";
    scoreAdjustment = -10;
    confidenceMultiplier = 0.5;
    humanSummary = "STRONG CONFLICT — Flow fully opposite";
  } else if (opposeCount >= 2) {
    alignment = "weak_oppose";
    scoreAdjustment = -5;
    confidenceMultiplier = 0.7;
    humanSummary = "MILD CONFLICT — Flow mostly opposite";
  } else {
    alignment = "neutral";
    scoreAdjustment = 0;
    confidenceMultiplier = 1.0;
    humanSummary = "NEUTRAL — Flow unclear";
  }

  // VPIN multiplier uygula (varsa)
  if (vpin && vpin.ready) {
    const signalAlignedWithFlow =
      alignment === "strong_align" || alignment === "weak_align";
    const vpinMult = vpinScoreMultiplier(vpin.vpin, signalAlignedWithFlow);
    confidenceMultiplier *= vpinMult;

    // VPIN yorum bilgisini summary'e ekle
    if (vpin.toxicity === "toxic" || vpin.toxicity === "extreme") {
      humanSummary += signalAlignedWithFlow
        ? ` · Smart money ${signalDirection === "LONG" ? "buying" : "selling"} (VPIN ${vpin.vpin.toFixed(2)})`
        : ` · WARNING: Smart money opposite (VPIN ${vpin.vpin.toFixed(2)})`;
    }
  }

  return {
    pair,
    signalDirection,
    cvd,
    divergence,
    vpin,
    alignment,
    scoreAdjustment,
    confidenceMultiplier,
    vetoed: false,
    vetoReason: null,
    humanSummary,
  };
}

/**
 * Boş / yetersiz veri durumu — flow filter'ı bypass et.
 *
 * Sinyal değişmeden geçer (nötr adjustment).
 */
export function emptyFlowVerdict(
  pair: Pair,
  signalDirection: SignalDirection,
): FlowVerdict {
  const emptyCvd: CvdMultiFrame = {
    pair,
    w1m: {
      windowMs: 60_000,
      cvdUsd: 0,
      tradeCount: 0,
      direction: "neutral",
      magnitude: "neutral",
      buyUsd: 0,
      sellUsd: 0,
    },
    w5m: {
      windowMs: 5 * 60_000,
      cvdUsd: 0,
      tradeCount: 0,
      direction: "neutral",
      magnitude: "neutral",
      buyUsd: 0,
      sellUsd: 0,
    },
    w15m: {
      windowMs: 15 * 60_000,
      cvdUsd: 0,
      tradeCount: 0,
      direction: "neutral",
      magnitude: "neutral",
      buyUsd: 0,
      sellUsd: 0,
    },
    confluence: 0,
    confluenceDirection: "neutral",
  };

  return {
    pair,
    signalDirection,
    cvd: emptyCvd,
    divergence: {
      pair,
      d5m: {
        type: "neutral",
        priceChangePct: 0,
        cvdUsd: 0,
        windowMs: 5 * 60_000,
        humanReason: "Veri yok",
      },
      d15m: {
        type: "neutral",
        priceChangePct: 0,
        cvdUsd: 0,
        windowMs: 15 * 60_000,
        humanReason: "Veri yok",
      },
      confluence: false,
      confluenceType: "none",
    },
    vpin: null,
    alignment: "neutral",
    scoreAdjustment: 0,
    confidenceMultiplier: 1.0,
    vetoed: false,
    vetoReason: null,
    humanSummary: "Yetersiz veri",
  };
}
