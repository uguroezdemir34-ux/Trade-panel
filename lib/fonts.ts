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

export const notoSansSC = Noto_Sans_SC({
  subsets: ["latin", "chinese-simplified"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-sc",
  display: "swap",
});

export const notoSansJP = Noto_Sans_JP({
  subsets: ["latin", "japanese"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const notoSansKR = Noto_Sans_KR({
  subsets: ["latin", "korean"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-arabic",
  display: "swap",
});

export const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ["latin", "devanagari"],
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
