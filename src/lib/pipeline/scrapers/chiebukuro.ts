import * as cheerio from "cheerio";
import type { RawComplaint, ScraperResult } from "../types";

const SEARCH_KEYWORDS = [
  "不便 改善してほしい",
  "使いにくい なぜ",
  "困っている アプリ",
  "クソ仕様 サービス",
];

export async function scrapeChiebukuro(
  keywords: string[] = SEARCH_KEYWORDS,
  limitPerKeyword = 10
): Promise<ScraperResult> {
  const complaints: RawComplaint[] = [];

  for (const keyword of keywords) {
    try {
      const url = `https://chiebukuro.yahoo.co.jp/search?p=${encodeURIComponent(keyword)}&flg=3&dnum=2078297830`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);

      $(".SearchResult__item").slice(0, limitPerKeyword).each((_, el) => {
        const title = $(el).find(".SearchResult__title a").text().trim();
        const body = $(el).find(".SearchResult__body").text().trim();
        const href = $(el).find(".SearchResult__title a").attr("href") || "";
        const text = body ? `${title}\n${body}` : title;

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
