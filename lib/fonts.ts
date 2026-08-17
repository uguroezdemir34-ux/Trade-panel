import localFont from "next/font/local";

// SELF-HOSTED — next/font/google KALDIRILDI (tekrar eden build hatası:
// next/font/google build sırasında Google Fonts'tan CSS+dosya çekiyor,
// bu fetch ara sıra başarısız oluyordu — "Failed to compile. lib/fonts.ts
// An error occurred in 'next/font'. TypeError: Cannot read properties of
// null" — Vercel'in gerçek production build log'unda görüldü, bkz. proje
// geçmişi). Artık build SIFIR internet erişimiyle tamamlanıyor: dosyalar
// npm paketleri olarak (@fontsource/*) çekiliyor — npm install ZATEN her
// build'in önkoşulu (Google Fonts'a ayrıca bir bağımlılık değil), sonra
// next/font/local o paketlerin İÇİNDEKİ .woff2 dosyalarını DOĞRUDAN
// node_modules'tan okuyor, hiçbir ağ isteği YAPMIYOR.
//
// DESEN — lib/share/fonts.ts'teki registerCardFonts()'un
// @expo-google-fonts/ibm-plex-mono'yu node_modules'tan path.join() ile
// okuma deseniyle BİREBİR TUTARLI (o dosya @napi-rs/canvas için sunucu
// tarafı font kaydı yapıyor, bu dosya next/font/local için tarayıcı
// tarafı — ikisi de AYNI fikri kullanıyor: "font dosyası zaten
// node_modules'ta bir npm paketinin içinde, ekstra bir fetch/indirme
// gerekmiyor").
//
// PATH'LER NEDEN TAM LİTERAL STRING (değişken/template-literal/spread
// YOK): next/font'un derleyici eklentisi (next/font/google İÇİN eskiden
// bu dosyada gerçek bir build hatasıyla doğrulanmış olan — bkz. git
// geçmişi, eski "DÜZELTME 2" notu — "Unexpected spread" hatası) src/path
// argümanlarını ÇALIŞTIRMADAN, AST üzerinden statik analiz ediyor; bu
// kısıt next/font/local için de GEÇERLİ SAYILIYOR (next/font ailesinin
// ikisi de aynı derleyici eklentisini paylaşıyor) — bu yüzden burada
// hiçbir ortak "dizin" sabiti/template-literal'ı KULLANILMADI, her yol
// AYRI AYRI tam literal string olarak yazıldı. Tekrar var ama bilinçli
// (aynı dosyanın önceki turdaki dersiyle tutarlı).
//
// DEĞİŞMEYEN: export edilen değişken isimleri (ibmPlexMono, ibmPlexSans,
// jetBrainsMono, notoSansSC/JP/KR/Arabic/Devanagari), .variable CSS
// değişken adları (--font-ibm-plex-mono vb.) ve fontVariables çıktısı
// HİÇ değişmedi — bu dosyayı import eden app/layout.tsx'e (fontVariables)
// dokunulmadı.
//
// AĞIRLIKLAR aynı kaldı: ibmPlexMono/ibmPlexSans/jetBrainsMono → 400/500/
// 600/700 (latin); Noto Sans 5'lisi → 400/500/700 — önceki next/font/google
// config'inin ağırlık listesiyle birebir.
//
// SUBSET KAPSAMI — BİLİNÇLİ DARALTMA (önceki next/font/google config'inden
// TEK fark): ibmPlexMono/ibmPlexSans/jetBrainsMono zaten SADECE "latin"
// kullanıyordu (KİRİL DOĞRULANDI notu — cyrillic hiç istenmiyordu, bu
// üçü DEĞİŞMEDİ). Noto Sans SC/JP/KR/Arabic/Devanagari'nin önceki
// next/font/google config'i, her ailenin KENDİ zorunlu script subset'ine
// (chinese-simplified/japanese/korean/arabic/devanagari — next/font/google
// bunları `subsets` listesine YAZDIRMIYORDU ama HER ZAMAN dahil ediyordu,
// bkz. eski DÜZELTME 1 notu) EK olarak cyrillic/latin/latin-ext/vietnamese
// gibi TAMAMLAYICI subset'ler de istiyordu (RU locale için savunmacı bir
// önlem, "Kesin kök neden doğrulanmadı" notuyla BİLEREK işaretlenmişti).
//
// next/font/local'ın src dizisi next/font/google'ın aksine unicode-range
// bazlı çoklu-subset birleştirmeyi DESTEKLEMİYOR (sadece weight/style
// eksenini ayırt ediyor) — aynı weight+style için birden fazla dosya
// vermek, hangi dosyanın "kazanacağı" belirsiz/dokümante edilmemiş bir
// davranış, YANLIŞ yapılırsa o ailenin ANA amacı olan script glyph'lerini
// (örn. Çince karakterlerin kendisi) SESSİZCE kırma riski taşır — bu
// yüzden burada SADECE her ailenin ZORUNLU/birincil script subset'i
// kullanıldı, tamamlayıcı cyrillic/latin/latin-ext/vietnamese/latin
// dosyaları BİLİNÇLİ OLARAK bırakıldı. Etkisi: RU locale'de Kiril metin
// artık bu Noto Sans ailelerinden DEĞİL, tarayıcının CSS font-family
// zincirinin sonundaki sistem fontundan render olacak (globals.css'teki
// zincir generic bir fallback'le bitiyorsa — genel App açısından tipik —
// bu KOZMETİK bir fark, tofu/□ DEĞİL) — ama bu HENÜZ CANLIDA GÖRSEL
// OLARAK DOĞRULANMADI, önceki "HENÜZ DOĞRULANMADI" notuyla AYNI risk
// kategorisinde kalıyor. Bozulursa düzeltme: ya PRIMARY fontlara
// (ibmPlexMono/Sans/jetBrainsMono) cyrillic subset eklemek ya da burada
// birleşik/geniş bir tek dosya bulmak gerekir — bu diff'in kapsamı DEĞİL.

export const ibmPlexMono = localFont({
  src: [
    { path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const ibmPlexSans = localFont({
  src: [
    { path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

export const jetBrainsMono = localFont({
  src: [
    { path: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Zorunlu/birincil script subset'i — bkz. dosya başı "SUBSET KAPSAMI" notu.
export const notoSansSC = localFont({
  src: [
    { path: "../node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-noto-sans-sc",
  display: "swap",
});

export const notoSansJP = localFont({
  src: [
    { path: "../node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const notoSansKR = localFont({
  src: [
    { path: "../node_modules/@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/noto-sans-kr/files/noto-sans-kr-korean-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/noto-sans-kr/files/noto-sans-kr-korean-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const notoSansArabic = localFont({
  src: [
    { path: "../node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-noto-sans-arabic",
  display: "swap",
});

export const notoSansDevanagari = localFont({
  src: [
    { path: "../node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-noto-sans-devanagari",
  display: "swap",
});

export const fontVariables = [
  ibmPlexMono.variable,
  ibmPlexSans.variable,
  jetBrainsMono.variable,
  notoSansSC.variable,
  notoSansJP.variable,
  notoSansKR.variable,
  notoSansArabic.variable,
  notoSansDevanagari.variable,
].join(" ");
