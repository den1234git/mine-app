import * as cheerio from "cheerio";
import type { RawComplaint, ScraperResult } from "../types";

const SEARCH_KEYWORDS = [
  "イライラする 日常",
  "なんでこんなに不便",
  "理不尽 ルール",
  "意味がわからない 制度",
  "マナー悪い 迷惑",
  "対応がひどい",
  "待たされる ストレス",
  "改善してほしい 生活",
];

export async function scrapeChiebukuro(
  keywords: string[] = SEARCH_KEYWORDS,
  limitPerKeyword = 10
): Promise<ScraperResult> {
  const complaints: RawComplaint[] = [];

  for (const keyword of keywords) {
    try {
      const url = `https://chiebukuro.yahoo.co.jp/search?p=${encodeURIComponent(keyword)}&flg=3`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "ja,en;q=0.5",
        },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);

      $("[class*='listSearchResults__listItem']").slice(0, limitPerKeyword).each((_, el) => {
        const item = $(el);
        const titleEl = item.find("[class*='listSearchResults__heading'] a");
        const title = titleEl.text().trim();
        const summary = item.find("[class*='listSearchResults__summary']").text().trim();
        const href = titleEl.attr("href") || "";
        const text = summary ? `${title}\n${summary}` : title;

        if (text.length < 10) return;

        const id = href.match(/q\d+/)?.[0] || `chie-${Date.now()}-${Math.random()}`;
        complaints.push({
          source: "chiebukuro",
          sourceId: `chiebukuro:${id}`,
          rawText: text,
          url: href.startsWith("http") ? href : `https://chiebukuro.yahoo.co.jp${href}`,
          scrapedAt: Date.now(),
        });
      });
    } catch {
      continue;
    }
  }

  return { complaints };
}
