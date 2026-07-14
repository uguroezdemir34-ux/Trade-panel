export type NewsSentiment = "positive" | "negative" | "neutral";

export interface NewsItem {
  /** Dedupe anahtarı — kaynak URL'i */
  id: string;
  source: "coindesk" | "cointelegraph" | "finnhub";
  title: string;
  url: string;
  /** Epoch ms */
  publishedAt: number;
  sentiment: NewsSentiment;
}
