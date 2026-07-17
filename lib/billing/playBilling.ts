"use client";

/**
 * PLAY BILLING WRAPPER — native Google Play abonelik satın alma.
 *
 * Plugin: `capacitor-native-purchases` (Cap-go) — üçüncü taraf backend yok
 * (RevenueCat vb.), doğrudan Google Play Billing Library'yi sarmalıyor.
 * API, kullanıcının kendi makinesinde `npm install` + `npx cap add android`
 * sonrası gerçek `node_modules/capacitor-native-purchases/dist/esm/
 * definitions.d.ts` içeriği okunarak doğrulandı (2026-07-17) — artık
 * tahmini/DOĞRULA'lı bir dosya değil.
 *
 * Android akışı SENKRON DEĞİL: `purchaseProduct()` yalnızca native satın alma
 * ekranını (popover) AÇAR, satın almanın kendisini beklemez/döndürmez —
 * `PurchaseProductAndroidResponseCode` sadece "popover açıldı" / "açılamadı"
 * bilgisi taşıyor. Kullanıcı ödemeyi tamamladığında plugin
 * `'ANDROID-PURCHASE-RESPONSE'` event'ini ateşliyor (`AndroidPurchasedTrigger`
 * yalnızca `{ fired: boolean }` taşıyor, purchaseToken YOK) — gerçek
 * purchaseToken/orderId'yi almak için event'ten sonra ayrıca
 * `getLatestTransaction()` çağırmak gerekiyor. Aşağıdaki `buySubscription()`
 * bu üç adımı (aç → event bekle → transaction çek) sarmalıyor.
 *
 * Response code → mesaj eşlemesi (`-1` = "Incompatible with web", `0` =
 * başarı, pozitif sayılar = çeşitli hata modları) dosyadaki HER response
 * tipinde tutarlı bir sırayla tekrarlanan bir örüntü — buna dayanarak
 * çıkarıldı, plugin'in kendi doc/README'si ile ayrıca teyit edilmedi ama
 * örüntü son derece tutarlı (definitions.d.ts'teki her response tipinde
 * aynı sıralama).
 *
 * SUNUCU DOĞRULAMASI: purchaseToken/orderId elde edildikten SONRA
 * `/api/billing/verify-google`'a (bkz. o route'un header'ı) açıkça POST
 * atılır — plugin'in kendi `setGoogleVerificationDetails` auto-callback
 * mekanizmasına bilerek güvenilmiyor (native tarafın hangi formatta POST
 * attığı doğrulanamadı). Bu, tamamen bizim kontrolümüzdeki bir sözleşme.
 *
 * Native olmayan ortamda (web/PWA) her iki fonksiyon da no-op/boş döner —
 * uygulama içi satın alma sadece Android native app'te (Google Play Billing
 * politikası kararı gereği) sunuluyor, web'de kullanıcı Stripe'a yönlendirilir
 * (bkz. app/upgrade/_inner.tsx).
 */

import type { PurchasesPlugin } from "capacitor-native-purchases";
import { isNativePlatform } from "@/lib/mobile/platform";

export const PRODUCT_IDS = {
  monthly: "quantix_premium_monthly",
  yearly: "quantix_premium_yearly",
} as const;

export type BillingProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

export interface BillingProduct {
  productId: string;
  /** Google Play'in kullanıcıya gösterdiği, yerelleştirilmiş fiyat string'i (örn. "₺129,99"). */
  price: string;
  title: string;
}

export interface PurchaseResult {
  productId: string;
  /** Backend doğrulaması (Google Play Developer API) için zorunlu. */
  purchaseToken: string;
  orderId: string;
  /**
   * `/api/billing/verify-google` çağrısı başarılı oldu mu (yani kullanıcının
   * Clerk plan'ı "pro"ya güncellendi mi)? `false` ise satın alma Google
   * tarafında GERÇEKLEŞTİ ama backend henüz haberdar değil — UI, kullanıcıya
   * "satın alma tamamlandı, birkaç dakika içinde aktive olacak" gibi bir
   * mesaj gösterip arka planda tekrar denemeli/desteğe yönlendirmeli.
   */
  verified: boolean;
}

const GOOGLE_VERIFY_ENDPOINT = "/api/billing/verify-google";
const ANDROID_APPLICATION_ID = "com.quantixos.trading"; // bkz. capacitor.config.ts appId

/**
 * Google'ın kendi doğrulamasından (purchases.subscriptions.get) SONRA
 * çalışır — bu sadece bizim backend'imize "artık pro'sun" dedirtme adımı.
 * Ağ hatası/backend hatası olursa throw ETMEZ, `false` döner — arayan taraf
 * (buySubscription) satın almanın kendisini yine de başarılı saymalı,
 * sadece `verified: false` işaretlemeli.
 */
async function verifyPurchaseWithServer(result: Omit<PurchaseResult, "verified">): Promise<boolean> {
  try {
    const res = await fetch(GOOGLE_VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseToken: result.purchaseToken,
        productId: result.productId,
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { verified?: boolean };
    return data.verified === true;
  } catch (err) {
    console.error("[playBilling] server verification failed:", err);
    return false;
  }
}

let _products: BillingProduct[] = [];
let _verificationConfigured = false;

async function loadPurchasesPlugin(): Promise<PurchasesPlugin> {
  const { Purchases } = await import("capacitor-native-purchases");
  if (!_verificationConfigured) {
    try {
      Purchases.setGoogleVerificationDetails({
        googleVerifyEndpoint: GOOGLE_VERIFY_ENDPOINT,
        bid: ANDROID_APPLICATION_ID,
      });
      _verificationConfigured = true;
    } catch (err) {
      console.error("[playBilling] setGoogleVerificationDetails failed:", err);
    }
  }
  return Purchases;
}

/**
 * Google Play Store'a bağlanır, PRODUCT_IDS'teki ürünlerin fiyat bilgisini
 * çeker. Native olmayan ortamda veya bir ürün bulunamazsa o ürünü/tümünü
 * atlar (throw etmez — çağıran taraf her zaman bir dizi bekleyebilir).
 */
export async function initializeBilling(): Promise<BillingProduct[]> {
  if (!isNativePlatform()) return [];

  try {
    const Purchases = await loadPurchasesPlugin();
    const skus = Object.values(PRODUCT_IDS);

    const details = await Promise.all(
      skus.map(async (productIdentifier): Promise<BillingProduct | null> => {
        try {
          const res = await Purchases.getProductDetails({ productIdentifier });
          // responseCode 0 = "Successfully found the product details..." (bkz. header)
          if (res.responseCode !== 0 || !res.data) return null;
          return {
            productId: res.data.productIdentifier,
            price: res.data.price,
            title: res.data.displayName,
          };
        } catch {
          return null;
        }
      })
    );

    _products = details.filter((d): d is BillingProduct => d !== null);
    return _products;
  } catch (err) {
    console.error("[playBilling] initializeBilling failed:", err);
    return [];
  }
}

/**
 * Native Google Play satın alma popover'ını açar, kullanıcı ödemeyi
 * tamamlayana kadar (en fazla 5dk) bekler, gerçek purchaseToken/orderId'yi
 * getLatestTransaction() ile çeker, sonra bunları /api/billing/verify-google
 * ile backend'e doğrulatır (bkz. verifyPurchaseWithServer). Kullanıcı
 * vazgeçer/hata olursa/zaman aşımına uğrarsa `null` döner — ama backend
 * doğrulaması başarısız olursa (ağ hatası vb.) `null` DÖNMEZ, satın alma
 * Google tarafında zaten gerçekleşti; bunun yerine `verified: false` ile
 * dönen sonuç işaretlenir (bkz. PurchaseResult.verified).
 */
export async function buySubscription(sku: BillingProductId): Promise<PurchaseResult | null> {
  if (!isNativePlatform()) return null;

  try {
    const Purchases = await loadPurchasesPlugin();

    const purchaseFired = new Promise<boolean>((resolve) => {
      let handle: { remove: () => void } | undefined;
      let settled = false;

      const settle = (fired: boolean) => {
        if (settled) return;
        settled = true;
        handle?.remove();
        resolve(fired);
      };

      const timeoutId = setTimeout(() => settle(false), 5 * 60_000);

      void Purchases.addListener("ANDROID-PURCHASE-RESPONSE", (response) => {
        clearTimeout(timeoutId);
        settle(response.fired);
      }).then((h) => {
        handle = h;
        // Timeout zaten tetiklenip settle() çağrıldıysa handle'ı hemen bırak.
        if (settled) h.remove();
      });
    });

    // responseCode 0 = "Successfully opened native popover" (bkz. header)
    const opened = await Purchases.purchaseProduct({ productIdentifier: sku });
    if (opened.responseCode !== 0) {
      return null;
    }

    const fired = await purchaseFired;
    if (!fired) return null;

    const latest = await Purchases.getLatestTransaction({ productIdentifier: sku });
    if (latest.responseCode !== 0 || !latest.data?.purchaseToken) {
      console.error("[playBilling] purchase fired but no transaction data:", latest);
      return null;
    }

    const partial = {
      productId: latest.data.productIdentifier,
      purchaseToken: latest.data.purchaseToken,
      orderId: latest.data.transactionId,
    };
    const verified = await verifyPurchaseWithServer(partial);

    return { ...partial, verified };
  } catch (err) {
    console.error("[playBilling] buySubscription failed:", err);
    return null;
  }
}

/** Son initializeBilling() çağrısından cache'lenmiş ürün listesi (UI'da fiyat göstermek için). */
export function getCachedProducts(): BillingProduct[] {
  return _products;
}
