import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  JetBrains_Mono,
  Noto_Sans_SC,
  Noto_Sans_JP,
  Noto_Sans_KR,
  Noto_Sans_Arabic,
  Noto_Sans_Devanagari,
} from "next/font/google";

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

export const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// DÜZELTME 1 (gerçek üretim build hatasıyla doğrulandı, tahmin değil):
// "chinese-simplified"/"japanese"/"korean"/"arabic"/"devanagari" bu next/font
// paketleri için GEÇERSİZ subset adları — Vercel build log'u 5 fontun 5'inde
// de aynı hatayı verdi ("Unknown subset '...' — Available subsets: cyrillic,
// latin, latin-ext, vietnamese"). Script glyph'lerinin kendisi (Han/Hangul/
// Arapça/Devanagari) subset seçimine bağlı DEĞİL — bu aileler zaten script'e
// özel (adları bunu söylüyor), "subset" burada sadece EK Latin/Kiril
// kapsamını kontrol ediyor. cyrillic BİLEREK dahil edildi — RU, CLAUDE.md'nin
// 7 desteklenen dilinden biri ve cyrillic gerçek hata mesajında geçerli
// seçenek olarak listelendi, çıkarmak için sebep yok.
//
// DÜZELTME 2 (yine gerçek build hatasıyla doğrulandı): ortak bir NOTO_SUBSETS
// sabiti tanımlayıp her çağrıda [...NOTO_SUBSETS] ile spread etmek "Unexpected
// spread" hatası verdi — next/font/google çağrılarını build-time'da statik
// olarak (AST üzerinden, çalıştırmadan) analiz eden bir derleyici eklentisiyle
// çalışıyor, argüman literal bir obje/dizi olmak ZORUNDA, değişken/spread/
// hesaplanmış değer kullanılamıyor (next/font'un belgelenmiş, projeye özgü
// olmayan bir kısıtı). Bu yüzden aynı dört değer beş çağrının her birine
// AYRI AYRI literal olarak yazıldı — tekrar var ama kaçınılmaz.
//
// HENÜZ DOĞRULANMADI: build başarılı olsa bile gerçek CJK/Arapça/Devanagari
// metnin görsel olarak doğru render olduğu (tofu/□ değil) canlıda kontrol
// edilmeli.

export const notoSansSC = Noto_Sans_SC({
  subsets: ["cyrillic", "latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-sc",
  display: "swap",
});

export const notoSansJP = Noto_Sans_JP({
  subsets: ["cyrillic", "latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const notoSansKR = Noto_Sans_KR({
  subsets: ["cyrillic", "latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["cyrillic", "latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-arabic",
  display: "swap",
});

export const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["cyrillic", "latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "700"],
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
