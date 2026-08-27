import * as cheerio from "cheerio";
import type { RawComplaint, ScraperResult } from "../types";

const APP_STORE_RSS = (appId: string, page: number) =>
  `https://itunes.apple.com/jp/rss/customerreviews/page=${page}/id=${appId}/sortBy=mostRecent/json`;

export async function scrapeAppStore(appId: string, pages = 3): Promise<ScraperResult> {
  const complaints: RawComplaint[] = [];

  for (let page = 1; page <= pages; page++) {
    try {
      const res = await fetch(APP_STORE_RSS(appId, page));
      if (!res.ok) continue;
      const data = await res.json();
      const entries = data?.feed?.entry;
      if (!Array.isArray(entries)) continue;

      for (const entry of entries) {
        const rating = parseInt(entry?.["im:rating"]?.label, 10);
        if (rating > 2) continue;

        const text = entry?.content?.label;
        if (!text) continue;

        complaints.push({
          source: "appstore",
          sourceId: `appstore:${appId}:${entry?.id?.label || Date.now()}`,
          rawText: text,
          rating,
          appName: data?.feed?.entry?.[0]?.["im:name"]?.label || undefined,
          url: entry?.link?.attributes?.href,
          scrapedAt: Date.now(),
        });
      }
    } catch {
      continue;
    }
  }

  return { complaints };
}
