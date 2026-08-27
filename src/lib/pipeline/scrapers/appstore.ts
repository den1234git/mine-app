import * as cheerio from "cheerio";
import type { RawComplaint, ScraperResult } from "../types";

const APP_STORE_RSS = (appId: string, page: number) =>
  `https://itunes.apple.com/jp/rss/customerreviews/page=${page}/id=${appId}/sortBy=mostRecent/json`;

const APP_ID_NAMES: Record<string, string> = {
  "1222370984": "PayPay",
  "1134232521": "メルカリ",
  "443904275": "LINE",
  "363590051": "Twitter",
  "389801252": "Instagram",
  "462141755": "楽天市場",
  "1103753401": "Uber Eats",
  "1164276441": "d払い",
  "1501631845": "楽天ペイ",
  "348070227": "Evernote",
  "1568185800": "マイナポータル",
  "1520310065": "COCOA",
  "529479190": "Yahoo!乗換案内",
  "1585891498": "モバイルSuica",
  "1217256498": "Slack",
  "1477376905": "au PAY",
};

export async function scrapeAppStore(appId: string, pages = 3): Promise<ScraperResult> {
  const complaints: RawComplaint[] = [];

  for (let page = 1; page <= pages; page++) {
    try {
      const res = await fetch(APP_STORE_RSS(appId, page));
      if (!res.ok) continue;
      const data = await res.json();
      const entries = data?.feed?.entry;
      if (!Array.isArray(entries)) continue;

      const appName = APP_ID_NAMES[appId]
        || entries.find((e: Record<string, unknown>) => (e as Record<string, Record<string, string>>)?.["im:name"]?.label)?.["im:name"]?.label
        || undefined;

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
          appName,
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
